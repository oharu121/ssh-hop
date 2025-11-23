import child_process from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import util from "util";
import type { SFTPClient } from "../core/SFTPClient";
import type { LoggerInterface } from "../types";
import { noOpLogger } from "./NoOpLogger";

const exec = util.promisify(child_process.exec);

/**
 * Helper class for SSH key management operations
 */
export class SSHKeyHelper {
  /**
   * Generate an SSH key pair if it doesn't already exist
   *
   * @param keyPath - Path to the private key file (default: ~/.ssh/id_rsa)
   * @param logger - Logger instance for output
   * @returns The private key content, or undefined if generation failed
   */
  static async generateKeyPair(
    keyPath?: string,
    logger: LoggerInterface = noOpLogger
  ): Promise<string | undefined> {
    const sshDir = keyPath
      ? path.dirname(keyPath)
      : path.join(os.homedir(), ".ssh");
    const privateKeyPath = keyPath || path.join(sshDir, "id_rsa");

    // Create .ssh directory if it doesn't exist
    if (!fs.existsSync(sshDir)) {
      logger.warning(`.ssh folder does not exist`);
      logger.task(`Creating ${sshDir}...`);
      fs.mkdirSync(sshDir, { recursive: true });
    }

    // Check if private key already exists
    let privateKey: string | undefined;
    let keyExists = false;

    try {
      privateKey = fs.readFileSync(privateKeyPath, "utf8");
      logger.success("Found private key locally.");
      keyExists = true;
    } catch {
      logger.warning("Private key not found.");
      logger.task("Generating new SSH key pair...");
      keyExists = false;
    }

    // Generate new key pair if it doesn't exist
    if (!keyExists) {
      try {
        await exec(
          `ssh-keygen -t rsa -b 4096 -f "${privateKeyPath}" -q -N ""`
        );
        logger.success("SSH key pair generated successfully.");
        privateKey = fs.readFileSync(privateKeyPath, "utf8");
      } catch (error) {
        logger.error(`Failed to generate SSH key pair: ${error}`);
      }
    }

    return privateKey;
  }

  /**
   * Upload public key to remote server's authorized_keys file
   *
   * @param sftp - SFTP client connected to the target server
   * @param username - Username on the remote server
   * @param publicKeyPath - Path to local public key file (default: ~/.ssh/id_rsa.pub)
   * @param logger - Logger instance for output
   * @returns True if upload succeeded, false otherwise
   */
  static async uploadPublicKey(
    sftp: SFTPClient,
    username: string,
    publicKeyPath?: string,
    logger: LoggerInterface = noOpLogger
  ): Promise<boolean> {
    const pubKeyPath =
      publicKeyPath || path.join(os.homedir(), ".ssh", "id_rsa.pub");

    // Read public key from local file
    let publicKey: string;
    try {
      publicKey = fs.readFileSync(pubKeyPath, "utf8");
    } catch (err) {
      logger.error(`Failed to read public key from ${pubKeyPath}: ${err}`);
      return false;
    }

    const remoteSSHDir = `/home/${username}/.ssh`;
    const authorizedKeysPath = `${remoteSSHDir}/authorized_keys`;

    // Check if authorized_keys file exists
    const authorizedKeysExists = await sftp.checkDir(authorizedKeysPath);

    if (authorizedKeysExists) {
      logger.success(`Found authorized_keys for user ${username}`);

      // Download and check if key already exists
      const tempFile = path.join(os.tmpdir(), `authorized_keys_${Date.now()}`);
      const downloaded = await sftp.fastget(authorizedKeysPath, tempFile);

      if (downloaded) {
        const authorizedKeys = fs.readFileSync(tempFile, "utf8");

        // Clean up temp file
        fs.unlinkSync(tempFile);

        if (authorizedKeys.includes(publicKey.trim())) {
          logger.info(`Public key already present in authorized_keys`);
          return true;
        } else {
          logger.task(
            `Public key not found in authorized_keys, appending for user ${username}`
          );
          await sftp.appendFile(authorizedKeysPath, `\n${publicKey}`);
          logger.success("Public key appended to authorized_keys");
          return true;
        }
      }
    }

    // authorized_keys doesn't exist, create it
    logger.info(`authorized_keys file does not exist for user ${username}`);

    // Ensure .ssh directory exists
    const dirExists = await sftp.checkDir(remoteSSHDir);
    if (!dirExists) {
      logger.warning(`Cannot find remote path ${remoteSSHDir}`);
      logger.task(`Creating .ssh folder for user ${username}`);
      const created = await sftp.makeDir(remoteSSHDir);

      if (!created) {
        logger.error(`Failed to create ${remoteSSHDir}`);
        return false;
      }

      logger.success(`Successfully created ${remoteSSHDir}`);
    }

    // Upload public key as authorized_keys
    logger.task(`Uploading public key to authorized_keys for user ${username}`);
    const uploaded = await sftp.fastput(pubKeyPath, authorizedKeysPath);

    if (!uploaded) {
      logger.error(`Failed to upload public key`);
      return false;
    }

    logger.success("Public key written to new authorized_keys file.");
    return true;
  }

  /**
   * Complete SSH key setup workflow:
   * 1. Generate key pair if it doesn't exist
   * 2. Upload public key to remote server
   *
   * @param sftp - SFTP client connected to the target server
   * @param username - Username on the remote server
   * @param keyPath - Path to private key file (optional, defaults to ~/.ssh/id_rsa)
   * @param logger - Logger instance for output
   * @returns True if setup succeeded, false otherwise
   */
  static async setupSSHKey(
    sftp: SFTPClient,
    username: string,
    keyPath?: string,
    logger: LoggerInterface = noOpLogger
  ): Promise<boolean> {
    // Generate key pair if needed
    await this.generateKeyPair(keyPath, logger);

    // Upload public key
    const publicKeyPath = keyPath ? `${keyPath}.pub` : undefined;
    return await this.uploadPublicKey(sftp, username, publicKeyPath, logger);
  }
}
