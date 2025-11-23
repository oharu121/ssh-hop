/**
 * Multiple Remotes Example
 *
 * Demonstrates connecting to multiple remote servers from a single jump server:
 * Local → Jump → [Prod DB, Staging DB, Prod K8s, Staging K8s]
 */

import { SSHOrchestrator, consoleLogger } from 'ssh-hop';

async function main() {
  // First establish the jump server connection
  const remote = new SSHOrchestrator({
    hops: [
      {
        name: 'jump',
        host: 'jump.example.com',
        port: 22,
        username: 'qa-user',
        password: 'password',
      },
    ],
    logger: consoleLogger,
  });

  await remote.connect();

  // Add multiple remote connections from the jump server
  console.log('\n=== Adding Remote Connections ===');

  await remote.addRemote('prod-db', {
    name: 'prod-db',
    host: '10.1.1.50',
    port: 22,
    username: 'qa',
    password: 'db-pass',
  });

  await remote.addRemote('staging-db', {
    name: 'staging-db',
    host: '10.2.1.50',
    port: 22,
    username: 'qa',
    password: 'db-pass',
  });

  await remote.addRemote('prod-k8s', {
    name: 'prod-k8s',
    host: '10.1.1.100',
    port: 22,
    username: 'qa',
    password: 'k8s-pass',
  });

  await remote.addRemote('staging-k8s', {
    name: 'staging-k8s',
    host: '10.2.1.100',
    port: 22,
    username: 'qa',
    password: 'k8s-pass',
  });

  // Execute commands on different remotes
  console.log('\n=== Query Production DB ===');
  const prodData = await remote.execOnRemote('prod-db', "mysql -e 'SELECT COUNT(*) FROM users;'");
  console.log(prodData);

  console.log('\n=== Query Staging DB ===');
  const stagingData = await remote.execOnRemote(
    'staging-db',
    "mysql -e 'SELECT COUNT(*) FROM users;'"
  );
  console.log(stagingData);

  console.log('\n=== Production K8s Pods ===');
  const prodPods = await remote.execOnRemote('prod-k8s', 'kubectl get pods');
  console.log(prodPods);

  console.log('\n=== Staging K8s Pods ===');
  const stagingPods = await remote.execOnRemote('staging-k8s', 'kubectl get pods');
  console.log(stagingPods);

  // SFTP to different remotes
  console.log('\n=== Upload to Production DB ===');
  const prodDbSFTP = await remote.getSFTPFor('prod-db');
  await prodDbSFTP.fastput('./backup.sql', '/tmp/restore.sql');

  console.log('=== Upload to Staging K8s ===');
  const stagingK8sSFTP = await remote.getSFTPFor('staging-k8s');
  await stagingK8sSFTP.fastput('./test-deployment.yaml', '/tmp/deployment.yaml');

  await remote.disconnect();
}

main().catch(console.error);
