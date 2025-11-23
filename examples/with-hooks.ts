/**
 * Example with Lifecycle Hooks
 *
 * Demonstrates using onHopConnected to perform custom authentication
 * after each hop is established (e.g., Pomerium, Robin, etc.)
 */

import { SSHOrchestrator, consoleLogger } from 'ssh-hop';

async function main() {
  const remote = new SSHOrchestrator({
    hops: [
      {
        name: 'jump',
        host: '127.0.0.1',
        port: 8888, // Pomerium proxy port
        username: 'qa-user',
        password: 'password',
      },
      {
        name: 'k8s-cluster',
        host: '10.0.1.50',
        port: 22,
        username: 'qa-user',
        password: 'password',
      },
    ],
    logger: consoleLogger,
    onHopConnected: async (index, config) => {
      console.log(`\n🔗 Connected to hop ${index}: ${config.name}`);

      // Perform custom actions based on which hop was connected
      if (config.name === 'jump') {
        console.log('→ Setting up jump server environment...');
        // Example: You might authenticate with Pomerium here
        // await pomerium.start();
      }

      if (config.name === 'k8s-cluster') {
        console.log('→ Authenticating with Robin pod orchestrator...');
        // Example: Authenticate with Robin
        // await remote.execRemote('robin login user --password pass');
        // await remote.execRemote('robin k8s get-kube-config --save-as-file');
      }
    },
  });

  await remote.connect();

  // Now you can execute commands
  const pods = await remote.execRemote('kubectl get pods');
  console.log('\nKubernetes Pods:');
  console.log(pods);

  await remote.disconnect();
}

main().catch(console.error);
