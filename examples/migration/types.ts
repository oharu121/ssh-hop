/**
 * Configuration types for the SSH connection
 *
 * Replaces the scattered environment lookups in the original:
 * - SessionDB.getEnv()
 * - credentials.SSH_USERNAME_*
 * - credentials.JUMP_SERVER_PASSWORD_*
 * - hosts.REMOTE_HOST_*
 * - ports.POMERIUM_PORT_*
 */

export type Environment = "prod" | "stg1" | "stg2" | "stg3";

export interface EnvironmentConfig {
  env: Environment;
  pomeriumPort: number;
  remoteHost: string;
  username: string;
  password: string;
  // Robin/Kubernetes configuration
  robin?: {
    clusterVIP: string;
    username: string;
    password: string;
    tenant?: string;
    namespace: string;
  };
}

/**
 * Example configurations - in practice, load these from environment
 * variables or a secure vault, not hardcoded values.
 */
export const configs: Record<Environment, EnvironmentConfig> = {
  prod: {
    env: "prod",
    pomeriumPort: 2222,
    remoteHost: "10.0.1.100",
    username: process.env.SSH_USERNAME_PROD || "prod-user",
    password: process.env.SSH_PASSWORD_PROD || "",
    robin: {
      clusterVIP: "10.0.1.1",
      username: process.env.ROBIN_USERNAME_PROD || "admin",
      password: process.env.ROBIN_PASSWORD_PROD || "",
      namespace: "production",
    },
  },
  stg1: {
    env: "stg1",
    pomeriumPort: 2223,
    remoteHost: "10.0.2.100",
    username: process.env.SSH_USERNAME_STG || "stg-user",
    password: process.env.SSH_PASSWORD_STG || "",
    robin: {
      clusterVIP: "10.0.2.1",
      username: process.env.ROBIN_USERNAME_STG || "admin",
      password: process.env.ROBIN_PASSWORD_STG || "",
      tenant: "staging1",
      namespace: "staging1",
    },
  },
  stg2: {
    env: "stg2",
    pomeriumPort: 2224,
    remoteHost: "10.0.3.100",
    username: process.env.SSH_USERNAME_STG || "stg-user",
    password: process.env.SSH_PASSWORD_STG || "",
    robin: {
      clusterVIP: "10.0.3.1",
      username: process.env.ROBIN_USERNAME_STG || "admin",
      password: process.env.ROBIN_PASSWORD_STG || "",
      tenant: "staging2",
      namespace: "staging2",
    },
  },
  stg3: {
    env: "stg3",
    pomeriumPort: 2225,
    remoteHost: "10.0.4.100",
    username: process.env.SSH_USERNAME_STG || "stg-user",
    password: process.env.SSH_PASSWORD_STG || "",
    robin: {
      clusterVIP: "10.0.4.1",
      username: process.env.ROBIN_USERNAME_STG || "admin",
      password: process.env.ROBIN_PASSWORD_STG || "",
      tenant: "staging3",
      namespace: "staging3",
    },
  },
};

/**
 * Get configuration for the current environment
 */
export function getConfig(env: Environment): EnvironmentConfig {
  const config = configs[env];
  if (!config) {
    throw new Error(`Unknown environment: ${env}`);
  }
  return config;
}
