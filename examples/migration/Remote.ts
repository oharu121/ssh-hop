/**
 * Rewritten Remote.ts using ssh-hop v1.2
 *
 * This example shows how to migrate /class/ssh/Remote.ts
 * from 469 lines of manual SSH management to ~80 lines using ssh-hop.
 *
 * v1.1 Features Used:
 * - `defaults` config for shared credentials across hops
 * - `onBeforeConnect` hook for Pomerium startup
 * - `onBeforeDisconnect` hook for cleanup
 * - `isConnected` property for state checking
 * - Optional `port` (defaults to 22)
 *
 * v1.2 Features Used:
 * - `autoConnect` - lazy connection on first exec (no explicit connect() needed)
 * - `PodFinder` - native kubectl pod searching
 */

import {
  SSHOrchestrator,
  SSHKeyHelper,
  SFTPClient,
  PodFinder,
  consoleLogger,
} from "ssh-hop";
import type { PodInfo } from "ssh-hop";
import type { EnvironmentConfig, Environment } from "./types";
import { getConfig } from "./types";
import type { ClientChannel } from "ssh2";

// These would be your existing integrations:
// import { pomeriumController } from "./Pomerium";
// import { Robin } from "./Robin";

/**
 * Remote - Singleton SSH orchestrator for bss-autopilot
 *
 * Usage:
 * ```typescript
 * // Set environment once at startup
 * Remote.setEnv("stg3");
 *
 * // Then use static methods anywhere - connection happens automatically!
 * const result = await Remote.execRemote("kubectl get pods");
 *
 * // Use PodFinder for pod discovery
 * const pod = await Remote.pods.findFirstRunningPod("utility");
 *
 * // Switch environments (auto-disconnects previous)
 * Remote.setEnv("prod");
 * await Remote.execRemote("kubectl get nodes");
 * ```
 */
export class Remote {
  private static _instance: Remote | null = null;
  private static _config: EnvironmentConfig | null = null;
  private orchestrator: SSHOrchestrator;
  private _pods: PodFinder;

  private constructor(config: EnvironmentConfig) {
    // v1.1: Use defaults for shared credentials - no more duplication!
    // v1.2: autoConnect enables lazy connection on first exec
    this.orchestrator = new SSHOrchestrator({
      autoConnect: true, // v1.2: No explicit connect() needed!
      defaults: {
        username: config.username,
        password: config.password,
        readyTimeout: 60000,
      },
      hops: [
        {
          name: "jump",
          host: "127.0.0.1", // Pomerium listens locally
          port: config.pomeriumPort,
        },
        {
          name: "remote",
          host: config.remoteHost,
          // port defaults to 22 (v1.1 feature)
        },
      ],
      logger: consoleLogger,

      // v1.1: Pre-connect hook - Pomerium starts BEFORE SSH connection
      onBeforeConnect: async () => {
        // await pomeriumController.start();
        console.log("Starting Pomerium tunnel...");
      },

      onHopConnected: async (index, hopConfig) => {
        if (hopConfig.name === "jump") {
          // SSH key setup after jump connection
          await this.ensureSSHKeySetup();
        }
        if (hopConfig.name === "remote") {
          // Robin setup after remote connection
          // const robin = new Robin(this);
          // await robin.start();
        }
      },

      // v1.1: Pre-disconnect hook for cleanup
      onBeforeDisconnect: async () => {
        // pomeriumController.stop();
        console.log("Stopping Pomerium tunnel...");
      },
    });

    // v1.2: PodFinder for native kubectl pod searching
    this._pods = new PodFinder(this.orchestrator);
  }

  /**
   * Set environment and reset instance if environment changed
   * Usage: Remote.setEnv("stg3")
   */
  static setEnv(env: Environment): void {
    const newConfig = getConfig(env);

    // If already initialized with different config, disconnect and reset
    if (Remote._instance && Remote._currentEnv !== env) {
      Remote._instance.orchestrator.disconnect().catch(() => {});
      Remote._instance = null;
    }

    Remote._currentEnv = env;
    Remote._config = newConfig;
  }

  private static _currentEnv: Environment | null = null;

  /**
   * Get singleton instance (auto-creates if setEnv was called)
   */
  private static ensureInstance(): Remote {
    if (!Remote._instance) {
      if (!Remote._config) {
        throw new Error("Remote not initialized. Call Remote.setEnv(env) first.");
      }
      Remote._instance = new Remote(Remote._config);
    }
    return Remote._instance;
  }

  /**
   * Initialize with explicit config (alternative to setEnv)
   */
  static initialize(config: EnvironmentConfig): Remote {
    Remote._config = config;
    if (!Remote._instance) {
      Remote._instance = new Remote(config);
    }
    return Remote._instance;
  }

  static get instance(): Remote {
    return Remote.ensureInstance();
  }

  // --- Static convenience methods for direct usage ---

  static async execRemote(cmd: string, debug = false): Promise<string> {
    return Remote.ensureInstance().execRemote(cmd, debug);
  }

  static async execJump(cmd: string, debug = false): Promise<string> {
    return Remote.ensureInstance().execJump(cmd, debug);
  }

  static get pods(): PodFinder {
    return Remote.ensureInstance().pods;
  }

  static async disconnect(): Promise<void> {
    if (Remote._instance) {
      await Remote._instance.disconnect();
      Remote._instance = null;
    }
  }

  /**
   * v1.2: PodFinder for kubectl pod discovery
   */
  get pods(): PodFinder {
    return this._pods;
  }

  /**
   * Replaces the old checkAuthorizedKeys + getPrivateKey logic
   * (~140 lines reduced to 2 method calls)
   */
  private async ensureSSHKeySetup(): Promise<void> {
    // Generate local key pair if missing (cross-platform)
    await SSHKeyHelper.generateKeyPair(undefined, consoleLogger);

    // Upload public key to jump server's authorized_keys
    const jumpSFTP = await this.orchestrator.getJumpSFTP();
    await SSHKeyHelper.uploadPublicKey(jumpSFTP, "username", undefined, consoleLogger);
  }

  /**
   * v1.2: With autoConnect, explicit connect() is optional
   * Connection happens automatically on first exec call
   */
  async connect(): Promise<void> {
    await this.orchestrator.connect();
  }

  async disconnect(): Promise<void> {
    await this.orchestrator.disconnect();
  }

  // v1.1: Use isConnected property instead of manual null checks
  get isConnected(): boolean {
    return this.orchestrator.isConnected;
  }

  // --- Command Execution ---

  async execJump(cmd: string, debug = false): Promise<string> {
    return this.orchestrator.execJump(cmd, debug);
  }

  async execRemote(cmd: string, debug = false): Promise<string> {
    return this.orchestrator.execRemote(cmd, debug);
  }

  // --- SFTP Access ---

  async getJumpSftp(): Promise<SFTPClient> {
    return this.orchestrator.getJumpSFTP();
  }

  async getRemoteSftp(): Promise<SFTPClient> {
    return this.orchestrator.getRemoteSFTP();
  }

  // --- Shell Access ---

  async openShell(): Promise<ClientChannel> {
    return this.orchestrator.openShell("remote");
  }

  async waitForString(stream: ClientChannel, expectedString: string): Promise<string> {
    return this.orchestrator.waitForString(stream, expectedString);
  }

  // --- Additional capabilities from ssh-hop ---

  async addRemote(name: string, host: string, port = 22): Promise<void> {
    // v1.1: Credentials inherited from defaults
    await this.orchestrator.addRemote(name, { name, host, port });
  }

  async execOnRemote(remoteName: string, cmd: string): Promise<string> {
    return this.orchestrator.execOnRemote(remoteName, cmd);
  }
}
