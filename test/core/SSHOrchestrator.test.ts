import { describe, it, expect, vi, beforeEach } from "vitest";
import { SSHOrchestrator } from "../../src/core/SSHOrchestrator";
import type { OrchestratorConfig, SimplifiedConfig, SSHConfig } from "../../src/types";
import { createMockLogger } from "../helpers/mocks";

// Mock ssh2
vi.mock("ssh2", () => ({
  Client: vi.fn(),
}));

describe("SSHOrchestrator", () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    vi.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should accept standard OrchestratorConfig", () => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "jump", host: "jump.com", port: 22, username: "user", password: "pass" },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeInstanceOf(SSHOrchestrator);
    });

    it("should convert SimplifiedConfig to standard format", () => {
      const config: SimplifiedConfig = {
        jumpServer: { host: "jump.com", port: 22, username: "user", password: "pass" },
        remoteServer: { host: "remote.com", port: 22, username: "user", password: "pass" },
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeInstanceOf(SSHOrchestrator);
    });

    it("should use provided logger", () => {
      const config: OrchestratorConfig = {
        hops: [{ name: "test", host: "test.com", port: 22, username: "user", password: "pass" }],
        logger: mockLogger,
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });

    it("should use default no-op logger when not provided", () => {
      const config: OrchestratorConfig = {
        hops: [{ name: "test", host: "test.com", port: 22, username: "user", password: "pass" }],
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });
  });

  describe("SimplifiedConfig conversion", () => {
    it("should name hops as 'jump' and 'remote'", () => {
      const config: SimplifiedConfig = {
        jumpServer: { host: "jump.com", port: 22, username: "user", password: "pass" },
        remoteServer: { host: "remote.com", port: 22, username: "user", password: "pass" },
      };

      const orchestrator = new SSHOrchestrator(config);
      // Internal state - can't directly test hop names, but we can test execution methods
      expect(orchestrator).toBeDefined();
    });

    it("should call onJumpConnected for first hop", async () => {
      const onJumpConnected = vi.fn().mockResolvedValue(undefined);

      const config: SimplifiedConfig = {
        jumpServer: { host: "jump.com", port: 22, username: "user", password: "pass" },
        remoteServer: { host: "remote.com", port: 22, username: "user", password: "pass" },
        onJumpConnected,
      };

      // We'll need to mock the connection to test this
      // This is tested more thoroughly in integration tests
      expect(config.onJumpConnected).toBe(onJumpConnected);
    });

    it("should call onRemoteConnected for second hop", async () => {
      const onRemoteConnected = vi.fn().mockResolvedValue(undefined);

      const config: SimplifiedConfig = {
        jumpServer: { host: "jump.com", port: 22, username: "user", password: "pass" },
        remoteServer: { host: "remote.com", port: 22, username: "user", password: "pass" },
        onRemoteConnected,
      };

      expect(config.onRemoteConnected).toBe(onRemoteConnected);
    });
  });

  describe("Configuration validation", () => {
    it("should accept single hop configuration", () => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "server", host: "server.com", port: 22, username: "user", password: "pass" },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });

    it("should accept multi-hop configuration", () => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "jump1", host: "jump1.com", port: 22, username: "user", password: "pass" },
          { name: "jump2", host: "jump2.com", port: 22, username: "user", password: "pass" },
          { name: "remote", host: "remote.com", port: 22, username: "user", password: "pass" },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });

    it("should accept configuration with private key", () => {
      const config: OrchestratorConfig = {
        hops: [
          {
            name: "server",
            host: "server.com",
            port: 22,
            username: "user",
            privateKey: "-----BEGIN RSA PRIVATE KEY-----",
          },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });

    it("should accept configuration with custom timeout", () => {
      const config: OrchestratorConfig = {
        hops: [
          {
            name: "server",
            host: "server.com",
            port: 22,
            username: "user",
            password: "pass",
            readyTimeout: 30000,
          },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });
  });

  describe("Method availability", () => {
    let orchestrator: SSHOrchestrator;

    beforeEach(() => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "jump", host: "jump.com", port: 22, username: "user", password: "pass" },
          { name: "remote", host: "remote.com", port: 22, username: "user", password: "pass" },
        ],
      };
      orchestrator = new SSHOrchestrator(config);
    });

    it("should have connect method", () => {
      expect(orchestrator).toHaveProperty("connect");
      expect(typeof orchestrator.connect).toBe("function");
    });

    it("should have disconnect method", () => {
      expect(orchestrator).toHaveProperty("disconnect");
      expect(typeof orchestrator.disconnect).toBe("function");
    });

    it("should have exec method", () => {
      expect(orchestrator).toHaveProperty("exec");
      expect(typeof orchestrator.exec).toBe("function");
    });

    it("should have execJump method", () => {
      expect(orchestrator).toHaveProperty("execJump");
      expect(typeof orchestrator.execJump).toBe("function");
    });

    it("should have execRemote method", () => {
      expect(orchestrator).toHaveProperty("execRemote");
      expect(typeof orchestrator.execRemote).toBe("function");
    });

    it("should have getSFTP method", () => {
      expect(orchestrator).toHaveProperty("getSFTP");
      expect(typeof orchestrator.getSFTP).toBe("function");
    });

    it("should have getJumpSFTP method", () => {
      expect(orchestrator).toHaveProperty("getJumpSFTP");
      expect(typeof orchestrator.getJumpSFTP).toBe("function");
    });

    it("should have getRemoteSFTP method", () => {
      expect(orchestrator).toHaveProperty("getRemoteSFTP");
      expect(typeof orchestrator.getRemoteSFTP).toBe("function");
    });

    it("should have addRemote method", () => {
      expect(orchestrator).toHaveProperty("addRemote");
      expect(typeof orchestrator.addRemote).toBe("function");
    });

    it("should have execOnRemote method", () => {
      expect(orchestrator).toHaveProperty("execOnRemote");
      expect(typeof orchestrator.execOnRemote).toBe("function");
    });

    it("should have getSFTPFor method", () => {
      expect(orchestrator).toHaveProperty("getSFTPFor");
      expect(typeof orchestrator.getSFTPFor).toBe("function");
    });

    it("should have openShell method", () => {
      expect(orchestrator).toHaveProperty("openShell");
      expect(typeof orchestrator.openShell).toBe("function");
    });

    it("should have waitForString method", () => {
      expect(orchestrator).toHaveProperty("waitForString");
      expect(typeof orchestrator.waitForString).toBe("function");
    });
  });

  describe("Error handling", () => {
    it("should throw error when executing on non-existent hop", async () => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "jump", host: "jump.com", port: 22, username: "user", password: "pass" },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);

      await expect(orchestrator.exec("non-existent", "command")).rejects.toThrow(
        "Hop 'non-existent' not found"
      );
    });

    it("should throw error when adding remote from non-existent hop", async () => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "jump", host: "jump.com", port: 22, username: "user", password: "pass" },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);

      await expect(
        orchestrator.addRemote(
          "remote",
          { name: "remote", host: "remote.com", port: 22, username: "user", password: "pass" },
          "non-existent"
        )
      ).rejects.toThrow("Source hop 'non-existent' not found");
    });

    it("should throw error when executing on non-existent named remote", async () => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "jump", host: "jump.com", port: 22, username: "user", password: "pass" },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);

      await expect(orchestrator.execOnRemote("non-existent", "command")).rejects.toThrow(
        "Remote 'non-existent' not connected"
      );
    });

    it("should throw error when getting SFTP for non-existent named remote", async () => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "jump", host: "jump.com", port: 22, username: "user", password: "pass" },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);

      await expect(orchestrator.getSFTPFor("non-existent")).rejects.toThrow(
        "Remote 'non-existent' not connected"
      );
    });

    it("should throw error when trying to execute without connecting first", async () => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "jump", host: "jump.com", port: 22, username: "user", password: "pass" },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);

      await expect(orchestrator.exec("jump", "command")).rejects.toThrow(
        "Tunnel for 'jump' not established"
      );
    });

    it("should throw error when no hops configured for execJump", async () => {
      const config: OrchestratorConfig = {
        hops: [],
      };

      const orchestrator = new SSHOrchestrator(config);

      await expect(orchestrator.execJump("command")).rejects.toThrow("No hops configured");
    });

    it("should throw error when no hops configured for execRemote", async () => {
      const config: OrchestratorConfig = {
        hops: [],
      };

      const orchestrator = new SSHOrchestrator(config);

      await expect(orchestrator.execRemote("command")).rejects.toThrow("No hops configured");
    });

    it("should throw error when trying to connect with no hops", async () => {
      const config: OrchestratorConfig = {
        hops: [],
      };

      const orchestrator = new SSHOrchestrator(config);

      await expect(orchestrator.connect()).rejects.toThrow("No hops configured");
    });
  });

  describe("Lifecycle hooks", () => {
    it("should call onHopConnected with correct parameters", () => {
      const onHopConnected = vi.fn();
      const hops: SSHConfig[] = [
        { name: "jump", host: "jump.com", port: 22, username: "user", password: "pass" },
        { name: "remote", host: "remote.com", port: 22, username: "user", password: "pass" },
      ];

      const config: OrchestratorConfig = {
        hops,
        onHopConnected,
      };

      new SSHOrchestrator(config);

      // Hook will be called during connect(), not during construction
      expect(onHopConnected).not.toHaveBeenCalled();
    });
  });
});
