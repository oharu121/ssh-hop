import { vi } from "vitest";
import type { Client, SFTPWrapper } from "ssh2";
import type { LoggerInterface } from "../../src/types";

/**
 * Create a mock SSH2 Client
 */
export function createMockClient(): Client {
  const mockClient = {
    connect: vi.fn().mockReturnThis(),
    end: vi.fn(),
    exec: vi.fn(),
    shell: vi.fn(),
    sftp: vi.fn(),
    forwardOut: vi.fn(),
    on: vi.fn().mockReturnThis(),
    removeAllListeners: vi.fn(),
  } as unknown as Client;

  return mockClient;
}

/**
 * Create a mock SFTP wrapper
 */
export function createMockSFTP(): SFTPWrapper {
  const mockSFTP = {
    fastPut: vi.fn(),
    fastGet: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    appendFile: vi.fn(),
    readdir: vi.fn(),
  } as unknown as SFTPWrapper;

  return mockSFTP;
}

/**
 * Create a mock logger that tracks calls
 */
export function createMockLogger(): LoggerInterface & {
  _calls: {
    info: string[];
    error: string[];
    warning: string[];
    success: string[];
    task: string[];
  };
} {
  const calls = {
    info: [] as string[],
    error: [] as string[],
    warning: [] as string[],
    success: [] as string[],
    task: [] as string[],
  };

  return {
    _calls: calls,
    info: vi.fn((msg: string) => calls.info.push(msg)),
    error: vi.fn((msg: string) => calls.error.push(msg)),
    warning: vi.fn((msg: string) => calls.warning.push(msg)),
    success: vi.fn((msg: string) => calls.success.push(msg)),
    task: vi.fn((msg: string) => calls.task.push(msg)),
  };
}

/**
 * Create a mock stream for command execution
 */
export function createMockStream() {
  const listeners: Record<string, Function[]> = {};

  return {
    on: vi.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
      return {
        on: vi.fn(),
        stderr: {
          on: vi.fn(),
        },
      };
    }),
    emit: (event: string, ...args: any[]) => {
      listeners[event]?.forEach((handler) => handler(...args));
    },
    stderr: {
      on: vi.fn(),
      emit: vi.fn(),
    },
  };
}
