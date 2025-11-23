import { PodTable } from "@utils/types/internal/data";
import Logger from "../common/Logger";
import SessionDB from "@class/db/SessionDB";
import settings from "@utils/constants/settings";
import Remote from "./Remote";

class Pod {
  public async searchPods(search: string): Promise<Array<PodTable>> {
    const cmd = `kubectl get pods | grep ${search}`;
    const searchResult = (await Remote.execRemote(cmd)) as string;
    const podLines = searchResult.trim().split("\n");
    const podObjects = await Promise.all(
      podLines.map(async (line) => {
        const splitLine = line.split(/\s+/);
        const podName = splitLine[0] || "";
        const podIP = await this.getPodIp(podName);

        return {
          name: podName,
          status: splitLine[2] || "",
          ip: podIP || "",
        };
      })
    );

    Logger.info(`These are the search results for ${search}`);
    console.table(podObjects);

    return podObjects;
  }

  private async getPodIp(podName: string): Promise<string> {
    const cmd = `kubectl get pod ${podName} -o jsonpath='{.status.podIP}'`;
    const podIP = (await Remote.execRemote(cmd)) as string;

    return podIP;
  }

  public async getPodBillDocGenService(): Promise<string[]> {
    const podMap = await this.getRunningPod("billdocgenservice");
    return podMap.map((pod) => pod.name);
  }

  private async getRunningPod(search: string): Promise<PodTable[]> {
    const podObjects = await this.searchPods(search);
    const runningPods = podObjects.filter((pod) => pod.status === "Running");
    //.map((pod) => pod.name);

    if (runningPods.length > 0) {
      Logger.success(`Found running pod(s)`);
      return runningPods;
    } else {
      throw new Error(`Couldn't find running pod for ${search}`);
    }
  }

  public async getPodUtility(): Promise<string[]> {
    const env = SessionDB.getEnv();
    let podMap: PodTable[] = [];

    switch (env) {
      case "prod":
        podMap = await this.getRunningPod(settings.TARGET_POD);
        break;
      case "stg1":
        podMap = await this.getRunningPod("utility");
        break;
      case "stg2":
        podMap = await this.getRunningPod("utility");
        break;
      case "stg3":
        podMap = await this.getRunningPod("utility");
        break;
    }

    return podMap.map((pod) => pod.name);
  }

  public async getPodKafka(): Promise<string[]> {
    const podMap = await this.getRunningPod("kafka-kafka");
    return podMap.map((pod) => pod.name);
  }

  public async getPodMySQL(): Promise<string[]> {
    const podMap = await this.getRunningPod(
      "mysql-stg3-mysqlinnocluster-node-1"
    );
    return podMap.map((pod) => pod.name);
  }

  public async getPodBillReports(): Promise<string[]> {
    const podMap = await this.getRunningPod("billreports");
    return podMap.map((pod) => pod.name);
  }
}

export default new Pod();
