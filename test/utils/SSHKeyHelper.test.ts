import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockLogger } from "../helpers/mocks";
import fs from "fs";
import os from "os";
import util from "util";

// Create mock exec function BEFORE module imports using vi.hoisted
const mockExec = vi.hoisted(() => vi.fn());

// Mock modules
vi.mock("fs");
vi.mock("os", () => ({
  default: {
    homedir: vi.fn(),
    tmpdir: vi.fn(() => "/tmp"),
  },
}));
vi.mock("child_process");
vi.mock("util", async (importOriginal) => {
  const actual = await importOriginal<typeof util>();
  return {
    ...actual,
    promisify: vi.fn(() => mockExec),
  };
});

// Import AFTER mocks are set up
import { SSHKeyHelper } from "../../src/utils/SSHKeyHelper";

describe("SSHKeyHelper", () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    // Don't use vi.clearAllMocks() as it clears mockExec
    vi.mocked(os.homedir).mockClear();
    vi.mocked(os.tmpdir).mockClear();
    vi.mocked(fs.existsSync).mockClear();
    vi.mocked(fs.readFileSync).mockClear();
    vi.mocked(fs.mkdirSync).mockClear();
    vi.mocked(fs.unlinkSync).mockClear();

    // Ensure tmpdir returns a valid path
    vi.mocked(os.tmpdir).mockReturnValue("/tmp");
    // Reset mockExec to default success behavior
    mockExec.mockClear();
    mockExec.mockResolvedValue({ stdout: "", stderr: "" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateKeyPair", () => {
    it("should return existing private key if it exists", async () => {
      const mockPrivateKey = "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----";

      vi.mocked(os.homedir).mockReturnValue("/home/user");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockPrivateKey);

      const result = await SSHKeyHelper.generateKeyPair(undefined, mockLogger);

      expect(result).toBe(mockPrivateKey);
      expect(mockLogger._calls.success).toContain("Found private key locally.");
    });

    it("should create .ssh directory if it doesn't exist", async () => {
      vi.mocked(os.homedir).mockReturnValue("/home/user");
      vi.mocked(fs.existsSync).mockReturnValueOnce(false); // .ssh doesn't exist
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(fs.readFileSync)
        .mockImplementationOnce(() => {
          throw new Error("ENOENT");
        })
        .mockReturnValueOnce("generated-key");

      await SSHKeyHelper.generateKeyPair(undefined, mockLogger);

      expect(fs.mkdirSync).toHaveBeenCalled();
      const call = vi.mocked(fs.mkdirSync).mock.calls[0];
      expect(call[0]).toContain(".ssh");
      expect(call[1]).toEqual(expect.objectContaining({ recursive: true }));
      expect(mockLogger._calls.warning).toContain(".ssh folder does not exist");
    });

    it("should generate new key pair if private key doesn't exist", async () => {
      vi.mocked(os.homedir).mockReturnValue("/home/user");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync)
        .mockImplementationOnce(() => {
          throw new Error("ENOENT");
        })
        .mockReturnValueOnce("new-private-key");

      const result = await SSHKeyHelper.generateKeyPair(undefined, mockLogger);

      expect(result).toBe("new-private-key");
      expect(mockLogger._calls.success).toContain("SSH key pair generated successfully.");
    });

    it("should use custom key path when provided", async () => {
      const customPath = "/custom/path/mykey";

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("custom-key");

      await SSHKeyHelper.generateKeyPair(customPath, mockLogger);

      expect(fs.readFileSync).toHaveBeenCalledWith(customPath, "utf8");
    });

    it("should log error if key generation fails", async () => {
      vi.mocked(os.homedir).mockReturnValue("/home/user");
      vi.mocked(fs.existsSync).mockReturnValue(true);

      // readFileSync should always throw (key doesn't exist and can't read after generation)
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("ENOENT: Key not found");
      });

      // Clear previous calls and set mockExec to reject
      mockExec.mockClear();
      mockExec.mockRejectedValue(new Error("ssh-keygen failed"));

      const result = await SSHKeyHelper.generateKeyPair(undefined, mockLogger);

      // The error should be logged (either from exec failing or from readFileSync failing after exec)
      expect(mockLogger._calls.error.length).toBeGreaterThan(0);
      expect(mockLogger._calls.error[0]).toContain("Failed to generate");
      // Result should be undefined since generation failed
      expect(result).toBeUndefined();
    });
  });

  describe("uploadPublicKey", () => {
    let mockSFTP: any;

    beforeEach(() => {
      mockSFTP = {
        checkDir: vi.fn(),
        fastget: vi.fn(),
        appendFile: vi.fn(),
        makeDir: vi.fn(),
        fastput: vi.fn(),
      };
    });

    it("should read public key from default path", async () => {
      const mockPublicKey = "ssh-rsa AAAA... user@host";

      vi.mocked(os.homedir).mockReturnValue("/home/user");
      vi.mocked(fs.readFileSync).mockReturnValue(mockPublicKey);
      vi.mocked(fs.unlinkSync).mockReturnValue(undefined);
      mockSFTP.checkDir.mockResolvedValue(true);
      mockSFTP.fastget.mockResolvedValue(true);
      vi.mocked(fs.readFileSync).mockReturnValueOnce(mockPublicKey).mockReturnValueOnce(mockPublicKey);

      const result = await SSHKeyHelper.uploadPublicKey(
        mockSFTP,
        "testuser",
        undefined,
        mockLogger
      );

      expect(result).toBe(true);
      expect(mockLogger._calls.info).toContain("Public key already present in authorized_keys");
    });

    it("should append public key if not present in authorized_keys", async () => {
      const mockPublicKey = "ssh-rsa NEW_KEY user@host";
      const existingKeys = "ssh-rsa OLD_KEY other@host";

      vi.mocked(os.homedir).mockReturnValue("/home/user");
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(mockPublicKey)
        .mockReturnValueOnce(existingKeys);
      vi.mocked(fs.unlinkSync).mockReturnValue(undefined);

      mockSFTP.checkDir.mockResolvedValue(true);
      mockSFTP.fastget.mockResolvedValue(true);
      mockSFTP.appendFile.mockResolvedValue(undefined);

      const result = await SSHKeyHelper.uploadPublicKey(
        mockSFTP,
        "testuser",
        undefined,
        mockLogger
      );

      expect(result).toBe(true);
      expect(mockSFTP.appendFile).toHaveBeenCalledWith(
        "/home/testuser/.ssh/authorized_keys",
        expect.stringContaining(mockPublicKey)
      );
      expect(mockLogger._calls.success).toContain("Public key appended to authorized_keys");
    });

    it("should create .ssh directory if it doesn't exist", async () => {
      const mockPublicKey = "ssh-rsa AAAA... user@host";

      vi.mocked(os.homedir).mockReturnValue("/home/user");
      vi.mocked(fs.readFileSync).mockReturnValue(mockPublicKey);

      mockSFTP.checkDir.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
      mockSFTP.makeDir.mockResolvedValue(true);
      mockSFTP.fastput.mockResolvedValue(true);

      const result = await SSHKeyHelper.uploadPublicKey(
        mockSFTP,
        "testuser",
        undefined,
        mockLogger
      );

      expect(result).toBe(true);
      expect(mockSFTP.makeDir).toHaveBeenCalledWith("/home/testuser/.ssh");
      expect(mockLogger._calls.success).toContain("Successfully created /home/testuser/.ssh");
    });

    it("should return false if public key file cannot be read", async () => {
      vi.mocked(os.homedir).mockReturnValue("/home/user");
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const result = await SSHKeyHelper.uploadPublicKey(
        mockSFTP,
        "testuser",
        undefined,
        mockLogger
      );

      expect(result).toBe(false);
      expect(mockLogger._calls.error.length).toBeGreaterThan(0);
    });

    it("should return false if directory creation fails", async () => {
      const mockPublicKey = "ssh-rsa AAAA... user@host";

      vi.mocked(fs.readFileSync).mockReturnValue(mockPublicKey);
      mockSFTP.checkDir.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
      mockSFTP.makeDir.mockResolvedValue(false);

      const result = await SSHKeyHelper.uploadPublicKey(
        mockSFTP,
        "testuser",
        undefined,
        mockLogger
      );

      expect(result).toBe(false);
      expect(mockLogger._calls.error).toContain("Failed to create /home/testuser/.ssh");
    });

    it("should return false if public key upload fails", async () => {
      const mockPublicKey = "ssh-rsa AAAA... user@host";

      vi.mocked(fs.readFileSync).mockReturnValue(mockPublicKey);
      mockSFTP.checkDir.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
      mockSFTP.makeDir.mockResolvedValue(true);
      mockSFTP.fastput.mockResolvedValue(false);

      const result = await SSHKeyHelper.uploadPublicKey(
        mockSFTP,
        "testuser",
        undefined,
        mockLogger
      );

      expect(result).toBe(false);
      expect(mockLogger._calls.error).toContain("Failed to upload public key");
    });

    it("should use custom public key path when provided", async () => {
      const customPath = "/custom/path/mykey.pub";
      const mockPublicKey = "ssh-rsa CUSTOM_KEY user@host";

      vi.mocked(fs.readFileSync).mockReturnValue(mockPublicKey);
      mockSFTP.checkDir.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
      mockSFTP.makeDir.mockResolvedValue(true);
      mockSFTP.fastput.mockResolvedValue(true);

      await SSHKeyHelper.uploadPublicKey(mockSFTP, "testuser", customPath, mockLogger);

      expect(fs.readFileSync).toHaveBeenCalledWith(customPath, "utf8");
    });
  });

  describe("setupSSHKey", () => {
    let mockSFTP: any;

    beforeEach(() => {
      mockSFTP = {
        checkDir: vi.fn(),
        fastget: vi.fn(),
        appendFile: vi.fn(),
        makeDir: vi.fn(),
        fastput: vi.fn(),
      };
    });

    it("should generate key pair and upload public key", async () => {
      const mockPrivateKey = "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----";
      const mockPublicKey = "ssh-rsa AAAA... user@host";

      vi.mocked(os.homedir).mockReturnValue("/home/user");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(mockPrivateKey)
        .mockReturnValueOnce(mockPublicKey);
      vi.mocked(fs.unlinkSync).mockReturnValue(undefined);

      mockSFTP.checkDir.mockResolvedValue(true);
      mockSFTP.fastget.mockResolvedValue(true);

      const result = await SSHKeyHelper.setupSSHKey(mockSFTP, "testuser", undefined, mockLogger);

      expect(result).toBe(true);
      expect(mockLogger._calls.success).toContain("Found private key locally.");
    });

    it("should return false if upload fails", async () => {
      const mockPrivateKey = "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----";

      vi.mocked(os.homedir).mockReturnValue("/home/user");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValueOnce(mockPrivateKey).mockImplementationOnce(() => {
        throw new Error("Cannot read public key");
      });

      const result = await SSHKeyHelper.setupSSHKey(mockSFTP, "testuser", undefined, mockLogger);

      expect(result).toBe(false);
    });
  });
});
