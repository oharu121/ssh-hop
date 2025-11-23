/**
 * Multi-Hop Chain Example
 *
 * Demonstrates arbitrary-length tunnel chains:
 * Local → Proxy → Bastion → Jump → K8s Master
 */

import { SSHOrchestrator, consoleLogger } from 'ssh-hop';
import fs from 'fs';

async function main() {
  const remote = new SSHOrchestrator({
    hops: [
      {
        name: 'proxy',
        host: '127.0.0.1',
        port: 8888,
        username: 'user',
        password: 'proxy-pass',
      },
      {
        name: 'bastion',
        host: 'bastion.dmz.example.com',
        port: 22,
        username: 'admin',
        privateKey: fs.readFileSync('./keys/bastion-key'),
      },
      {
        name: 'jump',
        host: '10.0.1.1',
        port: 22,
        username: 'qa',
        privateKey: fs.readFileSync('./keys/jump-key'),
      },
      {
        name: 'k8s-master',
        host: '10.0.50.100',
        port: 22,
        username: 'qa',
        privateKey: fs.readFileSync('./keys/k8s-key'),
      },
    ],
    logger: consoleLogger,
    onHopConnected: async (index, config) => {
      console.log(`✓ Connected to ${config.name} [${index + 1}/4]`);
    },
  });

  console.log('Establishing 4-hop tunnel chain...\n');
  await remote.connect();
  console.log('\n✓ All hops connected!\n');

  // Execute on different hops in the chain
  console.log('=== Execute on Bastion ===');
  const bastionUptime = await remote.exec('bastion', 'uptime');
  console.log(bastionUptime);

  console.log('\n=== Execute on Jump Server ===');
  const jumpDisk = await remote.exec('jump', 'df -h');
  console.log(jumpDisk);

  console.log('\n=== Execute on K8s Master ===');
  const k8sNodes = await remote.exec('k8s-master', 'kubectl get nodes');
  console.log(k8sNodes);

  // SFTP to different hops
  console.log('\n=== Upload to Bastion ===');
  const bastionSFTP = await remote.getSFTP('bastion');
  await bastionSFTP.fastput('./audit.log', '/var/log/audit.log');

  console.log('=== Upload to K8s Master ===');
  const k8sSFTP = await remote.getSFTP('k8s-master');
  await k8sSFTP.fastput('./deployment.yaml', '/tmp/deployment.yaml');

  await remote.disconnect();
}

main().catch(console.error);
