/**
 * Basic Usage Example
 *
 * Demonstrates simple two-hop SSH connection:
 * Local → Jump Server → Remote Server
 */

import { SSHOrchestrator, consoleLogger } from 'ssh-hop';
import fs from 'fs';

async function main() {
  // Create orchestrator with simple two-hop configuration
  const remote = new SSHOrchestrator({
    hops: [
      {
        name: 'jump',
        host: 'jump.example.com',
        port: 22,
        username: 'qa-user',
        password: 'your-password', // Or use privateKey
      },
      {
        name: 'k8s-cluster',
        host: '10.0.1.50',
        port: 22,
        username: 'qa-user',
        privateKey: fs.readFileSync(`${process.env.HOME}/.ssh/id_rsa`),
      },
    ],
    logger: consoleLogger,
  });

  // Connect to all hops in the chain
  await remote.connect();

  // Execute command on jump server
  console.log('\n=== Executing on Jump Server ===');
  const jumpResult = await remote.execJump('hostname && uptime');
  console.log(jumpResult);

  // Execute command on remote K8s cluster
  console.log('\n=== Executing on Remote K8s Cluster ===');
  const pods = await remote.execRemote('kubectl get pods');
  console.log(pods);

  // SFTP operations on jump server
  console.log('\n=== SFTP Upload to Jump Server ===');
  const jumpSFTP = await remote.getJumpSFTP();
  await jumpSFTP.fastput('./local-config.json', '/tmp/config.json');
  console.log('Uploaded config.json to jump server');

  // SFTP operations on remote server
  console.log('\n=== SFTP Upload to Remote Server ===');
  const remoteSFTP = await remote.getRemoteSFTP();
  await remoteSFTP.fastput('./deployment.yaml', '/tmp/deployment.yaml');
  console.log('Uploaded deployment.yaml to remote server');

  // Cleanup
  await remote.disconnect();
}

main().catch(console.error);
