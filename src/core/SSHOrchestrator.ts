import { Client, ClientChannel, ConnectConfig } from "ssh2";
import type {
  OrchestratorConfig,
  SSHConfig,
  SimplifiedConfig,
  LoggerInterface,
} from "../types";
import { SFTPClient } from "./SFTPClient";
import { noOpLogger } from "../utils/NoOpLogger";

/**
 * Resolved SSH configuration with all defaults applied
 * @internal
 */
interface ResolvedSSHConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string | Buffer;
  readyTimeout: number;
}

/**
 * SSH Orchestrator - Manages multi-hop SSH tunnel chains
 *
 * Supports:
 * - Arbitrary-length tunnel chains (User → Jump1 → Jump2 → ... → RemoteN)
 * - Command execution on any hop in the chain
 * - SFTP access to any hop in the chain
 * - Additional remote connections from any hop
 * - Automatic reconnection handling
 * - Lifecycle hooks for custom authentication (onBeforeConnect, onHopConnected, onBeforeDisconnect)
 * - Default credentials shared across hops
 */
export class SSHOrchestrator {
  private config: OrchestratorConfig;
  private logger: LoggerInterface;
  private tunnels: Client[] = [];
  private sftpClients: Map<string, SFTPClient> = new Map();
  private remotes: Map<string, Client> = new Map();

  /**
   * Check if the orchestrator is connected to all configured hops
   */
  public get isConnected(): boolean {
    return this.tunnels.length === this.config.hops.length && this.config.hops.length > 0;
  }

  constructor(config: OrchestratorConfig | SimplifiedConfig) {
    // Convert SimplifiedConfig to OrchestratorConfig if needed
    if ("jumpServer" in config) {
      this.config = this.convertSimplifiedConfig(config);
    } else {
      this.config = config;
    }

    this.logger = this.config.logger || noOpLogger;
  }

  /**
   * Convert simplified two-hop config to standard config format
   * @private
   */
  private convertSimplifiedConfig(config: SimplifiedConfig): OrchestratorConfig {
    const hops: SSHConfig[] = [
      { name: "jump", ...config.jumpServer },
      { name: "remote", ...config.remoteServer },
    ];

    return {
      hops,
      logger: config.logger,
      onHopConnected: async (index) => {
        if (index === 0 && config.onJumpConnected) {
          await config.onJumpConnected();
        } else if (index === 1 && config.onRemoteConnected) {
          await config.onRemoteConnected();
        }
      },
    };
  }

  /**
   * Resolve hop configuration by merging defaults with hop-specific config
   * Priority: hop config > defaults > built-in defaults
   * @private
   */
  private resolveCredentials(hop: SSHConfig): ResolvedSSHConfig {
    const defaults = this.config.defaults || {};

    return {
      name: hop.name,
      host: hop.host,
      port: hop.port ?? defaults.port ?? 22,
      username: hop.username ?? defaults.username ?? "",
      password: hop.password ?? defaults.password,
      privateKey: hop.privateKey ?? defaults.privateKey,
      readyTimeout: hop.readyTimeout ?? defaults.readyTimeout ?? 60000,
    };
  }

  /**
   * Establish the entire SSH tunnel chain
   * Connects to each hop sequentially and calls lifecycle hooks
   */
  public async connect(): Promise<void> {
    if (this.config.hops.length === 0) {
      throw new Error("No hops configured");
    }

    // Pre-connect hook (e.g., start Pomerium)
    if (this.config.onBeforeConnect) {
      await this.config.onBeforeConnect();
    }

    // First hop: direct connection
    const firstHopResolved = this.resolveCredentials(this.config.hops[0]);
    const firstTunnel = await this.connectDirect(firstHopResolved);
    this.tunnels.push(firstTunnel);

    if (this.config.onHopConnected) {
      await this.config.onHopConnected(0, this.config.hops[0]);
    }

    // Subsequent hops: tunnel through previous hop
    for (let i = 1; i < this.config.hops.length; i++) {
      const prevTunnel = this.tunnels[i - 1];
      const hopResolved = this.resolveCredentials(this.config.hops[i]);
      const nextTunnel = await this.connectThrough(prevTunnel, hopResolved);
      this.tunnels.push(nextTunnel);

      if (this.config.onHopConnected) {
        await this.config.onHopConnected(i, this.config.hops[i]);
      }
    }
  }

  /**
   * Direct SSH connection (for first hop)
   * @private
   */
  private connectDirect(config: ResolvedSSHConfig): Promise<Client> {
    return new Promise((resolve, reject) => {
      const tunnel = new Client();

      tunnel
        .on("ready", () => {
          this.logger.success(
            `Connected to ${config.name} (${config.host}:${config.port})`
          );

          // Setup reconnection handlers
          tunnel.on("error", (err) => {
            this.logger.error(`${config.name} Error: ${err.message}`);
            this.handleDisconnection(config.name);
          });

          tunnel.on("close", () => {
            this.logger.warning(`${config.name} Closed`);
            this.handleDisconnection(config.name);
          });

          resolve(tunnel);
        })
        .on("error", (err) => {
          this.logger.error(
            `Failed to connect to ${config.name} (${config.host}:${config.port})`
          );
          reject(err);
        })
        .connect(this.buildConnectConfig(config));
    });
  }

  /**
   * SSH connection through an existing tunnel
   * @private
   */
  private connectThrough(
    parentTunnel: Client,
    config: ResolvedSSHConfig
  ): Promise<Client> {
    return new Promise((resolve, reject) => {
      parentTunnel.forwardOut(
        "127.0.0.1",
        0,
        config.host,
        config.port,
        (err, stream) => {
          if (err) return reject(err);

          const newTunnel = new Client();
          newTunnel
            .on("ready", () => {
              this.logger.success(`Forwarded to ${config.name} (${config.host})`);

              // Setup reconnection handlers
              newTunnel.on("error", (err) => {
                this.logger.error(`${config.name} Error: ${err.message}`);
                this.handleDisconnection(config.name);
              });

              newTunnel.on("close", () => {
                this.logger.warning(`${config.name} Closed`);
                this.handleDisconnection(config.name);
              });

              resolve(newTunnel);
            })
            .on("error", (err) => {
              this.logger.error(`${config.name} connect error: ${err.message}`);
              reject(err);
            })
            .connect({
              sock: stream,
              ...this.buildConnectConfig(config),
            } as ConnectConfig);
        }
      );
    });
  }

  /**
   * Build SSH connection configuration from resolved hop config
   * @private
   */
  private buildConnectConfig(config: ResolvedSSHConfig): ConnectConfig {
    return {
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey,
      readyTimeout: config.readyTimeout,
    };
  }

  /**
   * Handle disconnection and attempt reconnection
   * @private
   */
  private handleDisconnection(hopName: string): void {
    this.logger.warning(`Attempting to re-establish ${hopName}...`);

    // Clear the affected tunnel and all downstream tunnels
    const hopIndex = this.config.hops.findIndex((h) => h.name === hopName);
    if (hopIndex !== -1) {
      this.tunnels = this.tunnels.slice(0, hopIndex);
      this.sftpClients.clear(); // Invalidate all SFTP clients
    }

    // Attempt reconnection
    this.connect().catch((err) => {
      this.logger.error(`Failed to re-establish ${hopName}: ${err.message}`);
    });
  }

  /**
   * Execute a command on a specific hop by name
   *
   * @param hopName - Name of the hop to execute on
   * @param cmd - Command to execute
   * @param debug - Enable debug output
   * @returns Promise resolving to command output
   */
  public async exec(
    hopName: string,
    cmd: string,
    debug: boolean = false
  ): Promise<string> {
    const hopIndex = this.config.hops.findIndex((h) => h.name === hopName);
    if (hopIndex === -1) {
      throw new Error(`Hop '${hopName}' not found`);
    }

    const tunnel = this.tunnels[hopIndex];
    if (!tunnel) {
      throw new Error(`Tunnel for '${hopName}' not established`);
    }

    return this.execOnTunnel(tunnel, cmd, debug);
  }

  /**
   * Execute a command on the jump server (first hop)
   *
   * @param cmd - Command to execute
   * @param debug - Enable debug output
   * @returns Promise resolving to command output
   */
  public async execJump(cmd: string, debug: boolean = false): Promise<string> {
    if (this.config.hops.length === 0) {
      throw new Error("No hops configured");
    }
    return this.exec(this.config.hops[0].name, cmd, debug);
  }

  /**
   * Execute a command on the final remote server
   *
   * @param cmd - Command to execute
   * @param debug - Enable debug output
   * @returns Promise resolving to command output
   */
  public async execRemote(
    cmd: string,
    debug: boolean = false
  ): Promise<string> {
    if (this.config.hops.length === 0) {
      throw new Error("No hops configured");
    }
    const finalHop = this.config.hops[this.config.hops.length - 1];
    return this.exec(finalHop.name, cmd, debug);
  }

  /**
   * Execute a command on a specific tunnel
   * @private
   */
  private execOnTunnel(
    tunnel: Client,
    cmd: string,
    debug: boolean = false
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      tunnel.exec(cmd, (err, stream) => {
        if (err) return reject(err);

        let data = "";
        let meta = "";

        stream.on("data", (chunk: Buffer) => (data += chunk.toString()));
        stream.stderr.on("data", (chunk: Buffer) => (meta += chunk.toString()));
        stream.on("end", () => {
          if (debug && meta) {
            this.logger.info(`Debug output: ${meta}`);
          }
          resolve(data);
        });
      });
    });
  }

  /**
   * Open an interactive shell on a specific hop
   *
   * @param hopName - Name of the hop (defaults to final hop)
   * @returns Promise resolving to shell stream
   */
  public async openShell(hopName?: string): Promise<ClientChannel> {
    const targetHop =
      hopName || this.config.hops[this.config.hops.length - 1].name;
    const hopIndex = this.config.hops.findIndex((h) => h.name === targetHop);

    if (hopIndex === -1) {
      throw new Error(`Hop '${targetHop}' not found`);
    }

    const tunnel = this.tunnels[hopIndex];
    if (!tunnel) {
      throw new Error(`Tunnel for '${targetHop}' not established`);
    }

    return new Promise((resolve, reject) => {
      tunnel.shell((err, stream) => {
        if (err) reject(err);
        else resolve(stream);
      });
    });
  }

  /**
   * Wait for a specific string to appear in shell stream output
   *
   * @param stream - Shell stream to monitor
   * @param expectedString - String to wait for
   * @returns Promise resolving to accumulated output
   */
  public async waitForString(
    stream: ClientChannel,
    expectedString: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = "";

      stream
        .on("data", (chunk: Buffer) => {
          const output = chunk.toString();
          this.logger.info(output);
          data += output;
          if (data.includes(expectedString)) {
            resolve(data);
          }
        })
        .stderr.on("data", (chunk: Buffer) => {
          reject(new Error(`STDERR: ${chunk.toString()}`));
        })
        .on("close", () => {
          reject(new Error("Unexpected stream close"));
        });
    });
  }

  /**
   * Get SFTP client for a specific hop
   *
   * @param hopName - Name of the hop (defaults to final hop)
   * @returns Promise resolving to SFTP client
   */
  public async getSFTP(hopName?: string): Promise<SFTPClient> {
    const targetHop =
      hopName || this.config.hops[this.config.hops.length - 1].name;

    // Return cached client if available
    if (this.sftpClients.has(targetHop)) {
      return this.sftpClients.get(targetHop)!;
    }

    // Find the tunnel for this hop
    const hopIndex = this.config.hops.findIndex((h) => h.name === targetHop);
    if (hopIndex === -1) {
      throw new Error(`Hop '${targetHop}' not found`);
    }

    const tunnel = this.tunnels[hopIndex];
    if (!tunnel) {
      throw new Error(`Tunnel for '${targetHop}' not established`);
    }

    // Create and cache SFTP client
    const sftp = new SFTPClient(tunnel, this.logger);
    this.sftpClients.set(targetHop, sftp);

    return sftp;
  }

  /**
   * Get SFTP client for jump server (first hop)
   * Backwards compatible with original API
   *
   * @returns Promise resolving to SFTP client
   */
  public async getJumpSFTP(): Promise<SFTPClient> {
    if (this.config.hops.length === 0) {
      throw new Error("No hops configured");
    }
    return this.getSFTP(this.config.hops[0].name);
  }

  /**
   * Get SFTP client for final remote server
   * Backwards compatible with original API
   *
   * @returns Promise resolving to SFTP client
   */
  public async getRemoteSFTP(): Promise<SFTPClient> {
    return this.getSFTP();
  }

  /**
   * Add an additional remote connection from a specific hop
   *
   * @param name - Unique name for this remote connection
   * @param config - SSH configuration for the remote
   * @param fromHop - Name of hop to connect from (defaults to final hop)
   */
  public async addRemote(
    name: string,
    config: SSHConfig,
    fromHop?: string
  ): Promise<void> {
    const sourceHop = fromHop || this.config.hops[this.config.hops.length - 1].name;
    const hopIndex = this.config.hops.findIndex((h) => h.name === sourceHop);

    if (hopIndex === -1) {
      throw new Error(`Source hop '${sourceHop}' not found`);
    }

    const parentTunnel = this.tunnels[hopIndex];
    if (!parentTunnel) {
      throw new Error(`Tunnel for '${sourceHop}' not established`);
    }

    const resolvedConfig = this.resolveCredentials(config);
    const remoteTunnel = await this.connectThrough(parentTunnel, resolvedConfig);
    this.remotes.set(name, remoteTunnel);
  }

  /**
   * Execute a command on a named remote connection
   *
   * @param remoteName - Name of the remote connection
   * @param cmd - Command to execute
   * @param debug - Enable debug output
   * @returns Promise resolving to command output
   */
  public async execOnRemote(
    remoteName: string,
    cmd: string,
    debug: boolean = false
  ): Promise<string> {
    const tunnel = this.remotes.get(remoteName);
    if (!tunnel) {
      throw new Error(`Remote '${remoteName}' not connected`);
    }

    return this.execOnTunnel(tunnel, cmd, debug);
  }

  /**
   * Get SFTP client for a named remote connection
   *
   * @param remoteName - Name of the remote connection
   * @returns Promise resolving to SFTP client
   */
  public async getSFTPFor(remoteName: string): Promise<SFTPClient> {
    // Check cache first
    if (this.sftpClients.has(remoteName)) {
      return this.sftpClients.get(remoteName)!;
    }

    const tunnel = this.remotes.get(remoteName);
    if (!tunnel) {
      throw new Error(`Remote '${remoteName}' not connected`);
    }

    const sftp = new SFTPClient(tunnel, this.logger);
    this.sftpClients.set(remoteName, sftp);

    return sftp;
  }

  /**
   * Close all SSH connections
   */
  public async disconnect(): Promise<void> {
    // Pre-disconnect hook (e.g., cleanup, stop Pomerium)
    if (this.config.onBeforeDisconnect) {
      await this.config.onBeforeDisconnect();
    }

    // Close all remote connections
    for (const [name, tunnel] of this.remotes.entries()) {
      tunnel.end();
      this.logger.info(`Disconnected remote: ${name}`);
    }
    this.remotes.clear();

    // Close all tunnels in reverse order
    for (let i = this.tunnels.length - 1; i >= 0; i--) {
      this.tunnels[i].end();
      this.logger.info(`Disconnected: ${this.config.hops[i].name}`);
    }
    this.tunnels = [];

    // Clear SFTP clients
    this.sftpClients.clear();
  }
}
