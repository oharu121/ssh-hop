import { Client, FileEntry, SFTPWrapper } from "ssh2";
import path from "path";
import type { LoggerInterface } from "../types";
import { noOpLogger } from "../utils/NoOpLogger";

/**
 * SFTP client wrapper for file operations on SSH connections
 */
export class SFTPClient {
  private tunnel: Client;
  private sftpTunnel?: SFTPWrapper;
  private logger: LoggerInterface;

  constructor(tunnel: Client, logger: LoggerInterface = noOpLogger) {
    this.tunnel = tunnel;
    this.logger = logger;
  }

  /**
   * Upload a local file to the remote server
   *
   * @param localPath - Path to local file
   * @param remotePath - Destination path on remote server
   * @returns Promise resolving to true if successful, false otherwise
   */
  public async fastput(
    localPath: string,
    remotePath: string
  ): Promise<boolean> {
    if (!this.sftpTunnel) await this.initSftp();

    // Auto-create parent directory if it doesn't exist
    await this.createIfNotExisted(path.dirname(remotePath));

    return new Promise((resolve) => {
      if (!this.sftpTunnel) throw new Error("SFTP tunnel not initialized");

      this.sftpTunnel.fastPut(localPath, remotePath, {}, (err) => {
        if (err) {
          this.logger.error(`Failed to upload ${localPath}: ${err.message}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Download a remote file to the local system
   *
   * @param remotePath - Path to remote file
   * @param localPath - Destination path on local system
   * @returns Promise resolving to true if successful, false otherwise
   */
  public async fastget(
    remotePath: string,
    localPath: string
  ): Promise<boolean> {
    if (!this.sftpTunnel) await this.initSftp();

    return new Promise((resolve) => {
      if (!this.sftpTunnel) throw new Error("SFTP tunnel not initialized");

      this.sftpTunnel.fastGet(remotePath, localPath, (err) => {
        if (err) {
          this.logger.error(`Failed to download ${remotePath}: ${err.message}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Check if a remote file or directory exists
   *
   * @param remotePath - Path to check on remote server
   * @returns Promise resolving to true if exists, false otherwise
   */
  public async checkDir(remotePath: string): Promise<boolean> {
    if (!this.sftpTunnel) await this.initSftp();

    return new Promise((resolve) => {
      if (!this.sftpTunnel) throw new Error("SFTP tunnel not initialized");

      this.sftpTunnel.stat(remotePath, (err) => {
        if (err) resolve(false);
        else resolve(true);
      });
    });
  }

  /**
   * Create a directory on the remote server
   *
   * @param remotePath - Path to directory to create
   * @returns Promise resolving to true if successful, false otherwise
   */
  public async makeDir(remotePath: string): Promise<boolean> {
    if (!this.sftpTunnel) await this.initSftp();

    return new Promise((resolve) => {
      if (!this.sftpTunnel) throw new Error("SFTP tunnel not initialized");

      this.sftpTunnel.mkdir(remotePath, (err) => {
        if (err) {
          this.logger.error(`Failed to create directory ${remotePath}: ${err.message}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Append text to a remote file
   *
   * @param remotePath - Path to remote file
   * @param text - Text to append
   * @returns Promise resolving when operation is complete
   */
  public async appendFile(remotePath: string, text: string): Promise<void> {
    if (!this.sftpTunnel) await this.initSftp();

    return new Promise((resolve, reject) => {
      if (!this.sftpTunnel) throw new Error("SFTP tunnel not initialized");

      const buffer = Buffer.from(text);
      this.sftpTunnel.appendFile(remotePath, buffer, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * List contents of a remote directory
   *
   * @param remotePath - Path to directory
   * @returns Promise resolving to array of file entries
   */
  public async readDir(remotePath: string): Promise<FileEntry[]> {
    if (!this.sftpTunnel) await this.initSftp();

    return new Promise((resolve, reject) => {
      if (!this.sftpTunnel) throw new Error("SFTP tunnel not initialized");

      this.sftpTunnel.readdir(remotePath, (err, list) => {
        if (err) reject(err);
        else resolve(list);
      });
    });
  }

  /**
   * Create a directory if it doesn't already exist
   *
   * @param remotePath - Path to directory
   * @returns Promise resolving when operation is complete
   */
  public async createIfNotExisted(remotePath: string): Promise<void> {
    const exists = await this.checkDir(remotePath);

    if (!exists) {
      this.logger.warning(`Directory ${remotePath} does not exist`);
      this.logger.task(`Creating ${remotePath}...`);

      const created = await this.makeDir(remotePath);

      if (!created) {
        this.logger.error(`Failed to create directory ${remotePath}`);
        return;
      }

      this.logger.success(`Successfully created ${remotePath}`);
    }
  }

  /**
   * Initialize the SFTP connection
   * @private
   */
  private initSftp(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.tunnel.sftp((err, sftp) => {
        if (err) reject(err);
        this.sftpTunnel = sftp;
        resolve();
      });
    });
  }
}
