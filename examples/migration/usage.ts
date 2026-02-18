/**
 * Usage example showing how to use the rewritten Remote class
 *
 * The API is nearly identical to the original implementation,
 * making migration straightforward.
 *
 * v1.2 Improvements:
 * - No explicit connect() needed (autoConnect handles it)
 * - PodFinder for native kubectl pod searching
 * - Singleton pattern for use anywhere in your app
 */

import { Remote } from "./Remote";
import { getConfig, type Environment } from "./types";

async function main() {
  // Get environment from CLI arg or default to stg1
  const env = (process.argv[2] as Environment) || "stg1";
  const config = getConfig(env);

  console.log(`Connecting to ${env} environment...`);

  // v1.2: Initialize singleton - connection happens lazily on first use
  const remote = Remote.initialize(config);

  try {
    // v1.2: No connect() needed! autoConnect handles it on first exec
    // await remote.connect();  // <-- Not required anymore!

    // --- Command Execution (same API as before) ---

    console.log("\n=== Kubernetes Pods ===");
    const pods = await remote.execRemote("kubectl get pods");
    console.log(pods);

    console.log("\n=== Node Info ===");
    const nodeInfo = await remote.execRemote("kubectl get nodes -o wide");
    console.log(nodeInfo);

    // --- v1.2: Native Pod Discovery ---

    console.log("\n=== Pod Discovery (v1.2 feature) ===");

    // Find running utility pods
    const utilityPods = await remote.pods.getRunningPods("utility");
    console.log(
      "Utility pods:",
      utilityPods.map((p: { name: string }) => p.name)
    );

    // Find first running pod matching pattern
    const kafkaPod = await remote.pods.findFirstRunningPod("kafka");
    if (kafkaPod) {
      console.log(`Found kafka pod: ${kafkaPod.name} (status: ${kafkaPod.status})`);

      // Execute command in the pod
      const kafkaVersion = await remote.execRemote(
        `kubectl exec ${kafkaPod.name} -- kafka-topics.sh --version 2>/dev/null || echo 'version check failed'`
      );
      console.log("Kafka version:", kafkaVersion.trim());
    }

    // Get pods with IP addresses
    const podsWithIP = await remote.pods.searchPodsWithIP("mysql");
    for (const pod of podsWithIP) {
      console.log(`Pod: ${pod.name}, IP: ${pod.ip}`);
    }

    // --- SFTP Operations (same API as before) ---

    console.log("\n=== SFTP Upload ===");
    const sftp = await remote.getRemoteSftp();

    // Upload a file (auto-creates parent directories)
    await sftp.fastput("./local-file.txt", "/tmp/uploaded-file.txt");
    console.log("File uploaded successfully");

    // List directory
    const files = await sftp.readDir("/tmp");
    console.log(
      "Files in /tmp:",
      files.map((f) => f.filename)
    );

    // --- Interactive Shell (same API as before) ---

    console.log("\n=== Interactive Shell ===");
    const shell = await remote.openShell();

    // Write command to shell
    shell.write("echo 'Hello from ssh-hop!'\n");

    // Wait for expected output
    const output = await remote.waitForString(shell, "Hello from ssh-hop!");
    console.log("Shell output:", output);

    shell.end();

    // --- New capabilities from ssh-hop ---

    console.log("\n=== Multiple Remotes (new feature) ===");

    // Add another remote connection from the jump server
    await remote.addRemote("db-server", "10.0.5.50", 22);

    // Execute on the new remote
    const dbVersion = await remote.execOnRemote(
      "db-server",
      "mysql --version || postgres --version || echo 'No DB found'"
    );
    console.log("DB Server:", dbVersion);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await remote.disconnect();
    console.log("\nDisconnected.");
  }
}

main().catch(console.error);
