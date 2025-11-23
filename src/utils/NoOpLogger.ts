import type { LoggerInterface } from "../types";

/**
 * No-op logger that discards all log messages
 * Used as the default logger when none is provided
 */
export const noOpLogger: LoggerInterface = {
  info: () => {},
  error: () => {},
  warning: () => {},
  success: () => {},
  task: () => {},
};
