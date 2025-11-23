import Logger from "../common/Logger";
import names from "@utils/constants/names";
import hosts from "@utils/constants/hosts";
import ports from "@utils/constants/ports";
import credentials from "@utils/constants/credentials";
import Remote from "./Remote";
import SessionDB from "@class/db/SessionDB";

class Robin {
  public async start(): Promise<void> {
    await this.removeOldContext();
    await this.addNewContext();
    await this.login();
    await this.saveKubeConfig();
    await this.setCurrentContext();
  }

  private namespace(): string {
    const env = SessionDB.getEnv();
    switch (env) {
      case "stg1":
        return names.NAMESPACE_STG1;
      case "stg2":
        return names.NAMESPACE_STG2;
      case "stg3":
        return names.NAMESPACE_STG3;
      case "prod":
        return names.NAMESPACE_PROD;
      default:
        return "";
    }
  }

  private tenant(): string {
    const env = SessionDB.getEnv();
    switch (env) {
      case "stg1":
        return names.TENANT_STG1;
      case "stg2":
        return names.TENANT_STG2;
      case "stg3":
        return names.TENANT_STG3;
      case "prod":
        return "";
      default:
        return ""; // Added a default case
    }
  }

  private clusterVIP(): string {
    const env = SessionDB.getEnv();
    switch (env) {
      case "prod":
        return hosts.CLUSTER_VIP_PROD;
      case "stg1":
        return hosts.CLUSTER_VIP_STG1;
      case "stg2":
        return hosts.CLUSTER_VIP_STG2;
      case "stg3":
        return hosts.CLUSTER_VIP_STG3;
      default:
        return ""; // Added a default case
    }
  }

  private async removeOldContext(): Promise<void> {
    await Remote.execRemote("rm -rf ~/.robin");
  }

  private async addNewContext(): Promise<void> {
    // FIX: Changed .join("") to .join(" ") to correctly form the command.
    const cmd = [
      `robin client`,
      `add-context ${this.clusterVIP()}`,
      `--port ${ports.ROBIN_PORT}`,
      `--event-port ${ports.ROBIN_PORT}`,
      `--file-port ${ports.ROBIN_PORT}`,
      `--set-current --product platform`,
    ].join(" ");

    await Remote.execRemote(cmd).then((result) => {
      if (typeof result === "string") Logger.info(result);
    });
  }

  private getLoginCommand(): string {
    const env = SessionDB.getEnv();
    switch (env) {
      case "prod":
        // FIX: Changed .join("") to .join(" ") to correctly form the command.
        return [
          `robin login ${credentials.ROBIN_USERNAME_PROD}`,
          `--password ${credentials.ROBIN_PASSWORD_PROD}`,
        ].join(" ");

      default:
        // FIX: Changed .join("") to .join(" ") to correctly form the command.
        return [
          `robin login ${credentials.ROBIN_USERNAME_STG}`,
          `--password ${credentials.ROBIN_PASSWORD_STG}`,
          `--tenant ${this.tenant()}`,
        ].join(" ");
    }
  }

  private async login(): Promise<void> {
    const cmd = this.getLoginCommand();
    const robinLoginResult = await Remote.execRemote(cmd);

    if (typeof robinLoginResult === "string") {
      if (robinLoginResult.includes("is logged in to")) {
        Logger.success(
          this.tenant()
            ? `Logged in to Robin with ${this.tenant()}`
            : "Logged in to Robin"
        );
        Logger.info(robinLoginResult);
      } else {
        Logger.error("user can't login to robin");
        Logger.info(robinLoginResult);
        process.exit(1);
      }
    }
  }

  private async saveKubeConfig(): Promise<void> {
    const cmd = [
      `mkdir -p ~/.kube`,
      `&&`,
      `robin k8s get-kube-config`,
      `--save-as-file`,
      `--dest-dir ~/.kube`,
    ].join(" ");

    await Remote.execRemote(cmd);
  }

  private async setCurrentContext(): Promise<void> {
    // FIX: Changed .join("") to .join(" ") to correctly form the command.
    const cmd = [
      `kubectl config`,
      `set-context`,
      `--current`,
      `--namespace=${this.namespace()}`,
    ].join(" ");

    await Remote.execRemote(cmd).then((result) => {
      if (typeof result === "string") Logger.info(result);
    });
  }
}

export default new Robin();
