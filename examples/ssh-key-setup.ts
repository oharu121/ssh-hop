/**
 * SSH Key Setup Example
 *
 * Demonstrates using SSHKeyHelper to generate and upload SSH keys
 * to remote servers for passwordless authentication
 */

import { SSHOrchestrator, SSHKeyHelper, consoleLogger } from 'ssh-hop';

async function main() {
  // First, connect with password authentication
  const remote = new SSHOrchestrator({
    hops: [
      {
        name: 'jump',
        host: 'jump.example.com',
        port: 22,
        username: 'qa-user',
        password: 'initial-password',
      },
      {
        name: 'remote',
        host: '10.0.1.50',
        port: 22,
        username: 'qa-user',
        password: 'initial-password',
      },
    ],
    logger: consoleLogger,
  });

  await remote.connect();

  console.log('\n=== Setting up SSH keys ===\n');

  // Generate SSH key pair if it doesn't exist
  console.log('→ Generating SSH key pair (if needed)...');
  await SSHKeyHelper.generateKeyPair(undefined, consoleLogger);

  // Upload public key to jump server
  console.log('\n→ Uploading public key to jump server...');
  const jumpSFTP = await remote.getJumpSFTP();
  await SSHKeyHelper.uploadPublicKey(jumpSFTP, 'qa-user', undefined, consoleLogger);

  // Upload public key to remote server
  console.log('\n→ Uploading public key to remote server...');
  const remoteSFTP = await remote.getRemoteSFTP();
  await SSHKeyHelper.uploadPublicKey(remoteSFTP, 'qa-user', undefined, consoleLogger);

  console.log('\n✓ SSH keys setup complete!');
  console.log('  You can now connect without passwords using your private key.\n');

  await remote.disconnect();

  // Reconnect using private key authentication
  console.log('=== Testing passwordless authentication ===\n');

  const remoteWithKey = new SSHOrchestrator({
    hops: [
      {
        name: 'jump',
        host: 'jump.example.com',
        port: 22,
        username: 'qa-user',
        privateKey: require('fs').readFileSync(`${process.env.HOME}/.ssh/id_rsa`),
      },
      {
        name: 'remote',
        host: '10.0.1.50',
        port: 22,
        username: 'qa-user',
        privateKey: require('fs').readFileSync(`${process.env.HOME}/.ssh/id_rsa`),
      },
    ],
    logger: consoleLogger,
  });

  await remoteWithKey.connect();
  console.log('\n✓ Successfully connected using SSH keys!');

  const result = await remoteWithKey.execRemote('whoami');
  console.log(`Current user: ${result.trim()}`);

  await remoteWithKey.disconnect();
}

main().catch(console.error);
