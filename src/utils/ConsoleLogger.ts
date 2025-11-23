import type { LoggerInterface } from "../types";

/**
 * Simple console logger implementation
 * Outputs formatted log messages to stdout/stderr
 */
export const consoleLogger: LoggerInterface = {
  info: (msg: string) => console.log(`ℹ ${msg}`),
  error: (msg: string) => console.error(`✗ ${msg}`),
  warning: (msg: string) => console.warn(`⚠ ${msg}`),
  success: (msg: string) => console.log(`✓ ${msg}`),
  task: (msg: string) => console.log(`→ ${msg}`),
};
