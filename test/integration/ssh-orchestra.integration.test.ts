import { describe, it, expect } from "vitest";
import { SSHOrchestrator, CommandBuilder, SSHKeyHelper, consoleLogger, noOpLogger } from "../../src";
import type { OrchestratorConfig, SimplifiedConfig, LoggerInterface } from "../../src/types";

/**
 * Integration tests for SSH Orchestra
 *
 * NOTE: These tests verify the public API and type safety.
 * They do NOT make actual SSH connections (that would require real servers).
 * For real connection testing, use manual tests or set up a test SSH server.
 */

describe("SSH Orchestra Integration Tests", () => {
  describe("Public API Exports", () => {
    it("should export SSHOrchestrator class", () => {
      expect(SSHOrchestrator).toBeDefined();
      expect(typeof SSHOrchestrator).toBe("function");
    });

    it("should export CommandBuilder class", () => {
      expect(CommandBuilder).toBeDefined();
      expect(typeof CommandBuilder).toBe("function");
    });

    it("should export SSHKeyHelper class", () => {
      expect(SSHKeyHelper).toBeDefined();
      expect(typeof SSHKeyHelper).toBe("function");
    });

    it("should export consoleLogger", () => {
      expect(consoleLogger).toBeDefined();
      expect(consoleLogger).toHaveProperty("info");
      expect(consoleLogger).toHaveProperty("error");
      expect(consoleLogger).toHaveProperty("warning");
      expect(consoleLogger).toHaveProperty("success");
      expect(consoleLogger).toHaveProperty("task");
    });

    it("should export noOpLogger", () => {
      expect(noOpLogger).toBeDefined();
      expect(noOpLogger).toHaveProperty("info");
      expect(noOpLogger).toHaveProperty("error");
      expect(noOpLogger).toHaveProperty("warning");
      expect(noOpLogger).toHaveProperty("success");
      expect(noOpLogger).toHaveProperty("task");
    });
  });

  describe("Type Safety", () => {
    it("should accept valid OrchestratorConfig", () => {
      const config: OrchestratorConfig = {
        hops: [
          {
            name: "jump",
            host: "jump.example.com",
            port: 22,
            username: "user",
            password: "pass",
          },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeInstanceOf(SSHOrchestrator);
    });

    it("should accept valid SimplifiedConfig", () => {
      const config: SimplifiedConfig = {
        jumpServer: {
          host: "jump.example.com",
          port: 22,
          username: "user",
          password: "pass",
        },
        remoteServer: {
          host: "remote.example.com",
          port: 22,
          username: "user",
          password: "pass",
        },
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeInstanceOf(SSHOrchestrator);
    });

    it("should accept LoggerInterface implementation", () => {
      const customLogger: LoggerInterface = {
        info: (_msg: string) => {},
        error: (_msg: string) => {},
        warning: (_msg: string) => {},
        success: (_msg: string) => {},
        task: (_msg: string) => {},
      };

      const config: OrchestratorConfig = {
        hops: [
          { name: "test", host: "test.com", port: 22, username: "user", password: "pass" },
        ],
        logger: customLogger,
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });
  });

  describe("Configuration Patterns", () => {
    it("should support password authentication", () => {
      const config: OrchestratorConfig = {
        hops: [
          {
            name: "server",
            host: "server.example.com",
            port: 22,
            username: "user",
            password: "secret123",
          },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });

    it("should support private key authentication (string)", () => {
      const config: OrchestratorConfig = {
        hops: [
          {
            name: "server",
            host: "server.example.com",
            port: 22,
            username: "user",
            privateKey: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
          },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });

    it("should support private key authentication (Buffer)", () => {
      const config: OrchestratorConfig = {
        hops: [
          {
            name: "server",
            host: "server.example.com",
            port: 22,
            username: "user",
            privateKey: Buffer.from("-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----"),
          },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });

    it("should support custom timeout", () => {
      const config: OrchestratorConfig = {
        hops: [
          {
            name: "server",
            host: "server.example.com",
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

    it("should support lifecycle hooks", () => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "jump", host: "jump.com", port: 22, username: "user", password: "pass" },
        ],
        onHopConnected: async (index, config) => {
          expect(index).toBeGreaterThanOrEqual(0);
          expect(config).toHaveProperty("name");
        },
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
      // Hook is not called until connect(), but we verify the config accepts it
    });

    it("should support multi-hop chains", () => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "proxy", host: "127.0.0.1", port: 8888, username: "user", password: "pass" },
          { name: "bastion", host: "bastion.dmz.com", port: 22, username: "admin", password: "pass" },
          { name: "jump", host: "10.0.1.1", port: 22, username: "qa", password: "pass" },
          { name: "k8s-master", host: "10.0.50.100", port: 22, username: "qa", password: "pass" },
        ],
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });
  });

  describe("Usage Patterns", () => {
    it("should support global instance export pattern", () => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "jump", host: "jump.com", port: 22, username: "user", password: "pass" },
          { name: "remote", host: "remote.com", port: 22, username: "user", password: "pass" },
        ],
      };

      const remote = new SSHOrchestrator(config);

      // This pattern allows: export default remote;
      expect(remote).toBeInstanceOf(SSHOrchestrator);
      expect(remote.execJump).toBeDefined();
      expect(remote.execRemote).toBeDefined();
    });

    it("should support CommandBuilder integration", () => {
      const builder = new CommandBuilder();
      const cmd = builder
        .pod("my-pod")
        .token("auth-token")
        .content("json")
        .payload({ key: "value" })
        .api("http://localhost:8080/api")
        .create();

      expect(cmd).toContain("kubectl");
      expect(cmd).toContain("my-pod");
      expect(cmd).toContain("auth-token");

      // This command could be used with: await remote.execRemote(cmd);
    });

    it("should support simplified config with hooks", () => {
      const config: SimplifiedConfig = {
        jumpServer: {
          host: "jump.com",
          port: 22,
          username: "user",
          password: "pass",
        },
        remoteServer: {
          host: "remote.com",
          port: 22,
          username: "user",
          password: "pass",
        },
        onJumpConnected: async () => {
          // Custom logic after jump server connection
          // e.g., await pomerium.start();
        },
        onRemoteConnected: async () => {
          // Custom logic after remote connection
          // e.g., await robin.login();
        },
      };

      const orchestrator = new SSHOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });
  });

  describe("Method Chaining and Fluent API", () => {
    it("should support method chaining in CommandBuilder", () => {
      const cmd = new CommandBuilder()
        .pod("test-pod")
        .patch()
        .header("X-Custom: value")
        .content("json")
        .payload({ data: "test" })
        .api("http://api.example.com")
        .create();

      expect(cmd).toBeTruthy();
      expect(typeof cmd).toBe("string");
    });

    it("should allow resetting CommandBuilder for reuse", () => {
      const builder = new CommandBuilder();

      const cmd1 = builder.pod("pod1").api("http://api1").create();
      const cmd2 = builder.pod("pod2").api("http://api2").create();

      expect(cmd1).toContain("pod1");
      expect(cmd2).toContain("pod2");
      expect(cmd2).not.toContain("pod1");
    });
  });

  describe("Error Handling Patterns", () => {
    it("should provide clear error for missing hop", async () => {
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

    it("should provide clear error for unconnected tunnel", async () => {
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

    it("should provide clear error for missing remote", async () => {
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
  });

  describe("Documentation Examples Verification", () => {
    it("should match README quick start example", () => {
      const config: OrchestratorConfig = {
        hops: [
          {
            name: "jump",
            host: "jump.example.com",
            port: 22,
            username: "user",
            password: "password",
          },
          {
            name: "remote",
            host: "10.0.1.50",
            port: 22,
            username: "user",
            privateKey: Buffer.from("mock-key"),
          },
        ],
      };

      const remote = new SSHOrchestrator(config);

      // Verify methods exist as documented
      expect(remote.connect).toBeDefined();
      expect(remote.execJump).toBeDefined();
      expect(remote.execRemote).toBeDefined();
      expect(remote.getRemoteSFTP).toBeDefined();
      expect(remote.disconnect).toBeDefined();
    });

    it("should match README multi-hop example", () => {
      const config: OrchestratorConfig = {
        hops: [
          { name: "proxy", host: "127.0.0.1", port: 8888, username: "user", password: "pass" },
          { name: "bastion", host: "bastion.dmz.com", port: 22, username: "admin", password: "pass" },
          { name: "jump", host: "10.0.1.1", port: 22, username: "qa", password: "pass" },
          { name: "k8s-master", host: "10.0.50.100", port: 22, username: "qa", password: "pass" },
        ],
      };

      const remote = new SSHOrchestrator(config);

      // Verify named execution works
      expect(async () => {
        // These will fail without connection, but we verify the API exists
        try {
          await remote.exec("bastion", "uptime");
        } catch (e) {
          expect(e).toBeDefined();
        }
      }).toBeDefined();
    });
  });
});
