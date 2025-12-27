/**
 * Usage example showing how to use the rewritten Remote class
 *
 * The API is nearly identical to the original  implementation,
 * making migration straightforward.
 */

import { Remote } from "./Remote";
import { getConfig, type Environment } from "./types";

async function main() {
  // Get environment from CLI arg or default to stg1
  const env = (process.argv[2] as Environment) || "stg1";
  const config = getConfig(env);

  console.log(`Connecting to ${env} environment...`);

  const remote = new Remote(config);

  try {
    // Connect through Pomerium → Jump → Remote
    await remote.connect();

    // --- Command Execution (same API as before) ---

    console.log("\n=== Kubernetes Pods ===");
    const pods = await remote.execRemote("kubectl get pods");
    console.log(pods);

    console.log("\n=== Node Info ===");
    const nodeInfo = await remote.execRemote("kubectl get nodes -o wide");
    console.log(nodeInfo);

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
