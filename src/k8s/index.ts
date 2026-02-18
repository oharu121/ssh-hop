/**
 * Kubernetes module for ssh-hop
 *
 * Provides kubectl-based pod discovery and management via SSH tunnel.
 *
 * @example
 * ```typescript
 * import { SSHOrchestrator, PodFinder } from 'ssh-hop';
 *
 * const orchestrator = new SSHOrchestrator({ autoConnect: true, ... });
 * const pods = new PodFinder(orchestrator);
 *
 * const utilityPod = await pods.findFirstRunningPod("utility");
 * ```
 */

export { PodFinder } from "./PodFinder";
export type { PodInfo } from "./types";
