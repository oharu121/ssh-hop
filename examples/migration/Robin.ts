/**
 * Robin.ts adapted to work with the new Remote class
 *
 * Key changes from original:
 * 1. Receives Remote instance via constructor (dependency injection)
 *    instead of importing a singleton
 * 2. Configuration passed in rather than using SessionDB.getEnv()
 * 3. Cleaner error handling with proper exceptions
 *
 * Original: 154 lines with scattered environment lookups
 * After: ~80 lines with clean configuration
 */

import { Remote } from "./Remote";
import type { EnvironmentConfig } from "./types";

export class Robin {
  private remote: Remote;
  private config: NonNullable<EnvironmentConfig["robin"]>;

  constructor(remote: Remote, config: EnvironmentConfig) {
    this.remote = remote;
    if (!config.robin) {
      throw new Error("Robin configuration is required");
    }
    this.config = config.robin;
  }

  /**
   * Complete Robin setup workflow
   */
  async start(): Promise<void> {
    await this.removeOldContext();
    await this.addNewContext();
    await this.login();
    await this.saveKubeConfig();
    await this.setCurrentContext();
  }

  private async removeOldContext(): Promise<void> {
    console.log("Removing old Robin context...");
    await this.remote.execRemote("rm -rf ~/.robin");
  }

  private async addNewContext(): Promise<void> {
    console.log(`Adding Robin context for cluster ${this.config.clusterVIP}...`);

    const cmd = [
      "robin client add-context",
      this.config.clusterVIP,
      "--port 443",
      "--event-port 443",
      "--file-port 443",
      "--set-current",
      "--product platform",
    ].join(" ");

    const result = await this.remote.execRemote(cmd);
    console.log(result);
  }

  private async login(): Promise<void> {
    console.log(`Logging into Robin as ${this.config.username}...`);

    const cmdParts = [
      "robin login",
      this.config.username,
      `--password ${this.config.password}`,
    ];

    // Add tenant for non-prod environments
    if (this.config.tenant) {
      cmdParts.push(`--tenant ${this.config.tenant}`);
    }

    const result = await this.remote.execRemote(cmdParts.join(" "));

    if (!result.includes("is logged in to")) {
      throw new Error(`Robin login failed: ${result}`);
    }

    console.log(
      this.config.tenant
        ? `Logged in to Robin with tenant ${this.config.tenant}`
        : "Logged in to Robin"
    );
  }

  private async saveKubeConfig(): Promise<void> {
    console.log("Saving kubeconfig...");

    const cmd = [
      "mkdir -p ~/.kube",
      "&&",
      "robin k8s get-kube-config",
      "--save-as-file",
      "--dest-dir ~/.kube",
    ].join(" ");

    await this.remote.execRemote(cmd);
  }

  private async setCurrentContext(): Promise<void> {
    console.log(`Setting kubectl namespace to ${this.config.namespace}...`);

    const cmd = [
      "kubectl config set-context",
      "--current",
      `--namespace=${this.config.namespace}`,
    ].join(" ");

    const result = await this.remote.execRemote(cmd);
    console.log(result);
  }
}

/**
 * Usage example:
 *
 * const remote = new Remote(config);
 * await remote.connect();
 *
 * const robin = new Robin(remote, config);
 * await robin.start();
 *
 * // Now you can use kubectl commands
 * const pods = await remote.execRemote("kubectl get pods");
 */
