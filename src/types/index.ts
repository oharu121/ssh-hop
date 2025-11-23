/**
 * SSH connection configuration for a single hop or server
 */
export interface SSHConfig {
  /** Unique identifier for this hop (e.g., 'jump', 'remote', 'bastion') */
  name: string;
  /** Hostname or IP address */
  host: string;
  /** SSH port (typically 22) */
  port: number;
  /** Username for authentication */
  username: string;
  /** Password authentication (optional) */
  password?: string;
  /** Private key authentication (optional, string path or Buffer) */
  privateKey?: string | Buffer;
  /** Connection timeout in milliseconds (default: 60000) */
  readyTimeout?: number;
}

/**
 * Configuration for the SSH Orchestrator
 */
export interface OrchestratorConfig {
  /** Array of SSH hops to tunnel through (in order) */
  hops: SSHConfig[];
  /** Optional logger implementation (defaults to no-op) */
  logger?: LoggerInterface;
  /** Callback fired after each hop is successfully connected */
  onHopConnected?: (hopIndex: number, config: SSHConfig) => Promise<void>;
}

/**
 * Logger interface for custom logging implementations
 */
export interface LoggerInterface {
  /** Log informational messages */
  info(message: string): void;
  /** Log error messages */
  error(message: string): void;
  /** Log warning messages */
  warning(message: string): void;
  /** Log success messages */
  success(message: string): void;
  /** Log task/action messages */
  task(message: string): void;
}

/**
 * Simplified configuration for two-hop connections (backwards compatibility)
 * This will be converted internally to the standard OrchestratorConfig format
 */
export interface SimplifiedConfig {
  /** Jump server configuration */
  jumpServer: Omit<SSHConfig, "name">;
  /** Remote server configuration */
  remoteServer: Omit<SSHConfig, "name">;
  /** Optional logger implementation */
  logger?: LoggerInterface;
  /** Callback fired after jump server connection */
  onJumpConnected?: () => Promise<void>;
  /** Callback fired after remote server connection */
  onRemoteConnected?: () => Promise<void>;
}
