import { describe, it, expect, vi, beforeEach } from "vitest";
import { SFTPClient } from "../../src/core/SFTPClient";
import { createMockClient, createMockSFTP, createMockLogger } from "../helpers/mocks";

describe("SFTPClient", () => {
  let mockClient: any;
  let mockSFTP: any;
  let mockLogger: any;
  let sftpClient: SFTPClient;

  beforeEach(() => {
    mockClient = createMockClient();
    mockSFTP = createMockSFTP();
    mockLogger = createMockLogger();

    // Setup default SFTP initialization
    mockClient.sftp = vi.fn((callback: Function) => {
      callback(null, mockSFTP);
    });

    sftpClient = new SFTPClient(mockClient, mockLogger);
  });

  describe("Constructor", () => {
    it("should create instance with SSH client", () => {
      expect(sftpClient).toBeInstanceOf(SFTPClient);
    });

    it("should use provided logger", () => {
      const client = new SFTPClient(mockClient, mockLogger);
      expect(client).toBeDefined();
    });

    it("should use default no-op logger when not provided", () => {
      const client = new SFTPClient(mockClient);
      expect(client).toBeDefined();
    });
  });

  describe("fastput", () => {
    it("should upload file successfully", async () => {
      mockSFTP.stat = vi.fn((path: string, callback: Function) => {
        callback(null, {}); // Directory exists
      });
      mockSFTP.fastPut = vi.fn((local: string, remote: string, opts: any, callback: Function) => {
        callback(null);
      });

      const result = await sftpClient.fastput("/local/file.txt", "/remote/file.txt");

      expect(result).toBe(true);
      expect(mockSFTP.fastPut).toHaveBeenCalledWith(
        "/local/file.txt",
        "/remote/file.txt",
        {},
        expect.any(Function)
      );
    });

    it("should return false on upload error", async () => {
      mockSFTP.stat = vi.fn((path: string, callback: Function) => {
        callback(null, {});
      });
      mockSFTP.fastPut = vi.fn((local: string, remote: string, opts: any, callback: Function) => {
        callback(new Error("Upload failed"));
      });

      const result = await sftpClient.fastput("/local/file.txt", "/remote/file.txt");

      expect(result).toBe(false);
      expect(mockLogger._calls.error.length).toBeGreaterThan(0);
    });

    it("should auto-create parent directory if it doesn't exist", async () => {
      mockSFTP.stat = vi.fn((path: string, callback: Function) => {
        if (path.includes("/remote")) {
          callback(new Error("Not found")); // Directory doesn't exist
        } else {
          callback(null, {});
        }
      });
      mockSFTP.mkdir = vi.fn((path: string, callback: Function) => {
        callback(null);
      });
      mockSFTP.fastPut = vi.fn((local: string, remote: string, opts: any, callback: Function) => {
        callback(null);
      });

      await sftpClient.fastput("/local/file.txt", "/remote/dir/file.txt");

      expect(mockSFTP.mkdir).toHaveBeenCalled();
    });
  });

  describe("fastget", () => {
    it("should download file successfully", async () => {
      mockSFTP.fastGet = vi.fn((remote: string, local: string, callback: Function) => {
        callback(null);
      });

      const result = await sftpClient.fastget("/remote/file.txt", "/local/file.txt");

      expect(result).toBe(true);
      expect(mockSFTP.fastGet).toHaveBeenCalledWith(
        "/remote/file.txt",
        "/local/file.txt",
        expect.any(Function)
      );
    });

    it("should return false on download error", async () => {
      mockSFTP.fastGet = vi.fn((remote: string, local: string, callback: Function) => {
        callback(new Error("Download failed"));
      });

      const result = await sftpClient.fastget("/remote/file.txt", "/local/file.txt");

      expect(result).toBe(false);
      expect(mockLogger._calls.error.length).toBeGreaterThan(0);
    });
  });

  describe("checkDir", () => {
    it("should return true if path exists", async () => {
      mockSFTP.stat = vi.fn((path: string, callback: Function) => {
        callback(null, { isDirectory: () => true });
      });

      const result = await sftpClient.checkDir("/remote/path");

      expect(result).toBe(true);
      expect(mockSFTP.stat).toHaveBeenCalledWith("/remote/path", expect.any(Function));
    });

    it("should return false if path does not exist", async () => {
      mockSFTP.stat = vi.fn((path: string, callback: Function) => {
        callback(new Error("Not found"));
      });

      const result = await sftpClient.checkDir("/remote/path");

      expect(result).toBe(false);
    });
  });

  describe("makeDir", () => {
    it("should create directory successfully", async () => {
      mockSFTP.mkdir = vi.fn((path: string, callback: Function) => {
        callback(null);
      });

      const result = await sftpClient.makeDir("/remote/newdir");

      expect(result).toBe(true);
      expect(mockSFTP.mkdir).toHaveBeenCalledWith("/remote/newdir", expect.any(Function));
    });

    it("should return false on mkdir error", async () => {
      mockSFTP.mkdir = vi.fn((path: string, callback: Function) => {
        callback(new Error("Permission denied"));
      });

      const result = await sftpClient.makeDir("/remote/newdir");

      expect(result).toBe(false);
      expect(mockLogger._calls.error.length).toBeGreaterThan(0);
    });

    it("should log error message on failure", async () => {
      const error = new Error("Permission denied");
      mockSFTP.mkdir = vi.fn((path: string, callback: Function) => {
        callback(error);
      });

      await sftpClient.makeDir("/remote/newdir");

      expect(mockLogger._calls.error[0]).toContain("Permission denied");
    });
  });

  describe("appendFile", () => {
    it("should append text to file", async () => {
      mockSFTP.appendFile = vi.fn((path: string, buffer: Buffer, callback: Function) => {
        callback(null);
      });

      await sftpClient.appendFile("/remote/file.txt", "appended text");

      expect(mockSFTP.appendFile).toHaveBeenCalled();
      const callArgs = mockSFTP.appendFile.mock.calls[0];
      expect(callArgs[0]).toBe("/remote/file.txt");
      expect(Buffer.isBuffer(callArgs[1])).toBe(true);
      expect(callArgs[1].toString()).toBe("appended text");
    });

    it("should reject on append error", async () => {
      mockSFTP.appendFile = vi.fn((path: string, buffer: Buffer, callback: Function) => {
        callback(new Error("Write failed"));
      });

      await expect(
        sftpClient.appendFile("/remote/file.txt", "text")
      ).rejects.toThrow("Write failed");
    });
  });

  describe("readDir", () => {
    it("should list directory contents", async () => {
      const mockFiles = [
        { filename: "file1.txt", attrs: {} },
        { filename: "file2.txt", attrs: {} },
      ];

      mockSFTP.readdir = vi.fn((path: string, callback: Function) => {
        callback(null, mockFiles);
      });

      const result = await sftpClient.readDir("/remote/dir");

      expect(result).toEqual(mockFiles);
      expect(mockSFTP.readdir).toHaveBeenCalledWith("/remote/dir", expect.any(Function));
    });

    it("should reject on readdir error", async () => {
      mockSFTP.readdir = vi.fn((path: string, callback: Function) => {
        callback(new Error("Not a directory"));
      });

      await expect(sftpClient.readDir("/remote/file.txt")).rejects.toThrow(
        "Not a directory"
      );
    });
  });

  describe("createIfNotExisted", () => {
    it("should not create directory if it already exists", async () => {
      mockSFTP.stat = vi.fn((path: string, callback: Function) => {
        callback(null, {});
      });
      mockSFTP.mkdir = vi.fn();

      await sftpClient.createIfNotExisted("/remote/existing");

      expect(mockSFTP.mkdir).not.toHaveBeenCalled();
    });

    it("should create directory if it does not exist", async () => {
      mockSFTP.stat = vi.fn((path: string, callback: Function) => {
        callback(new Error("Not found"));
      });
      mockSFTP.mkdir = vi.fn((path: string, callback: Function) => {
        callback(null);
      });

      await sftpClient.createIfNotExisted("/remote/newdir");

      expect(mockSFTP.mkdir).toHaveBeenCalledWith("/remote/newdir", expect.any(Function));
      expect(mockLogger._calls.warning.length).toBeGreaterThan(0);
      expect(mockLogger._calls.success.length).toBeGreaterThan(0);
    });

    it("should log warning when directory does not exist", async () => {
      mockSFTP.stat = vi.fn((path: string, callback: Function) => {
        callback(new Error("Not found"));
      });
      mockSFTP.mkdir = vi.fn((path: string, callback: Function) => {
        callback(null);
      });

      await sftpClient.createIfNotExisted("/remote/newdir");

      expect(mockLogger._calls.warning[0]).toContain("does not exist");
      expect(mockLogger._calls.task[0]).toContain("Creating");
    });

    it("should log error if mkdir fails", async () => {
      mockSFTP.stat = vi.fn((path: string, callback: Function) => {
        callback(new Error("Not found"));
      });
      mockSFTP.mkdir = vi.fn((path: string, callback: Function) => {
        callback(new Error("Permission denied"));
      });

      await sftpClient.createIfNotExisted("/remote/newdir");

      expect(mockLogger._calls.error[0]).toContain("Failed to create");
    });
  });

  describe("SFTP Initialization", () => {
    it("should initialize SFTP connection on first use", async () => {
      mockSFTP.stat = vi.fn((path: string, callback: Function) => {
        callback(null, {});
      });

      await sftpClient.checkDir("/test");

      expect(mockClient.sftp).toHaveBeenCalled();
    });

    it("should reuse SFTP connection on subsequent calls", async () => {
      mockSFTP.stat = vi.fn((path: string, callback: Function) => {
        callback(null, {});
      });

      await sftpClient.checkDir("/test1");
      await sftpClient.checkDir("/test2");

      expect(mockClient.sftp).toHaveBeenCalledTimes(1);
    });

    it("should handle SFTP initialization errors", async () => {
      const errorClient = createMockClient();
      errorClient.sftp = vi.fn((callback: Function) => {
        callback(new Error("SFTP init failed"));
      });

      const client = new SFTPClient(errorClient);

      await expect(client.checkDir("/test")).rejects.toThrow("SFTP init failed");
    });
  });
});
