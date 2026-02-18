/**
 * Information about a Kubernetes pod
 */
export interface PodInfo {
  /** Pod name */
  name: string;
  /** Ready status (e.g., "1/1", "0/1") */
  ready: string;
  /** Pod status (e.g., "Running", "Pending", "CrashLoopBackOff") */
  status: string;
  /** Number of restarts */
  restarts: string;
  /** Age of the pod (e.g., "2d", "5h", "10m") */
  age: string;
  /** Pod IP address (optional, fetched separately) */
  ip?: string;
}
