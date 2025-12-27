/**
 * Rewritten Remote.ts using ssh-hop v1.1
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
 */

import {
  SSHOrchestrator,
  SSHKeyHelper,
  SFTPClient,
  consoleLogger,
} from "ssh-hop";
import type { EnvironmentConfig } from "./types";
import type { ClientChannel } from "ssh2";

// These would be your existing integrations:
// import { pomeriumController } from "./Pomerium";
// import { Robin } from "./Robin";

export class Remote {
  private orchestrator: SSHOrchestrator;

  constructor(config: EnvironmentConfig) {
    // v1.1: Use defaults for shared credentials - no more duplication!
    this.orchestrator = new SSHOrchestrator({
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
