import type { SSHOrchestrator } from "../core/SSHOrchestrator";
import type { PodInfo } from "./types";

/**
 * PodFinder - Kubernetes pod discovery and management
 *
 * Provides kubectl-based pod searching capabilities via SSH tunnel.
 * Works with SSHOrchestrator to execute kubectl commands on remote servers.
 *
 * @example
 * ```typescript
 * const orchestrator = new SSHOrchestrator({ autoConnect: true, ... });
 * const pods = new PodFinder(orchestrator);
 *
 * // Find running pods matching a pattern
 * const utilityPods = await pods.getRunningPods("utility");
 * console.log(utilityPods[0]?.name); // "utility-deployment-abc123"
 *
 * // Get first running pod directly
 * const pod = await pods.findFirstRunningPod("kafka");
 * if (pod) {
 *   const result = await orchestrator.execRemote(`kubectl exec ${pod.name} -- whoami`);
 * }
 * ```
 */
export class PodFinder {
  constructor(private orchestrator: SSHOrchestrator) {}

  /**
   * Search for pods matching a pattern
   *
   * @param pattern - Partial pod name to search for (uses grep)
   * @param namespace - Optional namespace (uses current context if not specified)
   * @returns Array of matching pods
   */
  public async searchPods(
    pattern: string,
    namespace?: string
  ): Promise<PodInfo[]> {
    const nsFlag = namespace ? `-n ${namespace}` : "";
    const cmd = `kubectl get pods ${nsFlag} --no-headers 2>/dev/null | grep "${pattern}" || true`;

    const result = await this.orchestrator.execRemote(cmd);
    return this.parsePodOutput(result);
  }

  /**
   * Get all pods in namespace
   *
   * @param namespace - Optional namespace (uses current context if not specified)
   * @returns Array of all pods
   */
  public async getAllPods(namespace?: string): Promise<PodInfo[]> {
    const nsFlag = namespace ? `-n ${namespace}` : "";
    const cmd = `kubectl get pods ${nsFlag} --no-headers 2>/dev/null || true`;

    const result = await this.orchestrator.execRemote(cmd);
    return this.parsePodOutput(result);
  }

  /**
   * Get running pods matching a pattern
   *
   * @param pattern - Partial pod name to search for
   * @param namespace - Optional namespace
   * @returns Array of running pods matching pattern
   */
  public async getRunningPods(
    pattern: string,
    namespace?: string
  ): Promise<PodInfo[]> {
    const pods = await this.searchPods(pattern, namespace);
    return pods.filter((pod) => pod.status === "Running");
  }

  /**
   * Find the first running pod matching a pattern
   *
   * @param pattern - Partial pod name to search for
   * @param namespace - Optional namespace
   * @returns First running pod or null if none found
   */
  public async findFirstRunningPod(
    pattern: string,
    namespace?: string
  ): Promise<PodInfo | null> {
    const pods = await this.getRunningPods(pattern, namespace);
    return pods.length > 0 ? pods[0] : null;
  }

  /**
   * Get the IP address of a specific pod
   *
   * @param podName - Full pod name
   * @param namespace - Optional namespace
   * @returns Pod IP address or empty string if not found
   */
  public async getPodIP(podName: string, namespace?: string): Promise<string> {
    const nsFlag = namespace ? `-n ${namespace}` : "";
    const cmd = `kubectl get pod ${podName} ${nsFlag} -o jsonpath='{.status.podIP}' 2>/dev/null || true`;

    const result = await this.orchestrator.execRemote(cmd);
    return result.trim().replace(/'/g, "");
  }

  /**
   * Get pod info with IP address populated
   *
   * @param pattern - Partial pod name to search for
   * @param namespace - Optional namespace
   * @returns Array of pods with IP addresses
   */
  public async searchPodsWithIP(
    pattern: string,
    namespace?: string
  ): Promise<PodInfo[]> {
    const pods = await this.searchPods(pattern, namespace);

    // Fetch IPs in parallel
    const podsWithIPs = await Promise.all(
      pods.map(async (pod) => ({
        ...pod,
        ip: await this.getPodIP(pod.name, namespace),
      }))
    );

    return podsWithIPs;
  }

  /**
   * Check if a pod exists and is running
   *
   * @param podName - Full pod name
   * @param namespace - Optional namespace
   * @returns True if pod exists and is running
   */
  public async isPodRunning(
    podName: string,
    namespace?: string
  ): Promise<boolean> {
    const nsFlag = namespace ? `-n ${namespace}` : "";
    const cmd = `kubectl get pod ${podName} ${nsFlag} -o jsonpath='{.status.phase}' 2>/dev/null || true`;

    const result = await this.orchestrator.execRemote(cmd);
    return result.trim().replace(/'/g, "") === "Running";
  }

  /**
   * Parse kubectl get pods output into PodInfo array
   * @private
   */
  private parsePodOutput(output: string): PodInfo[] {
    const lines = output.trim().split("\n").filter(Boolean);

    return lines.map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        name: parts[0] || "",
        ready: parts[1] || "",
        status: parts[2] || "",
        restarts: parts[3] || "",
        age: parts[4] || "",
      };
    });
  }
}
