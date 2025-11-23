# ssh-hop

[![npm version](https://badge.fury.io/js/ssh-hop.svg)](https://badge.fury.io/js/ssh-hop)
![License](https://img.shields.io/npm/l/ssh-hop)
![Types](https://img.shields.io/npm/types/ssh-hop)
![NPM Downloads](https://img.shields.io/npm/dw/ssh-hop)
![Last Commit](https://img.shields.io/github/last-commit/oharu121/ssh-hop)
![Coverage](https://codecov.io/gh/oharu121/ssh-hop/branch/main/graph/badge.svg)
![CI Status](https://github.com/oharu121/ssh-hop/actions/workflows/ci.yml/badge.svg)
![GitHub Stars](https://img.shields.io/github/stars/oharu121/ssh-hop?style=social)

A flexible, type-safe SSH orchestration library for Node.js that simplifies multi-hop SSH tunneling, remote command execution, and SFTP operations.

## Features

- ✅ **Multi-hop SSH tunnels** - Connect through arbitrary-length server chains
- ✅ **Execute commands** on any hop in the chain
- ✅ **SFTP operations** to any server in the tunnel
- ✅ **Multiple authentication methods** - Password, private key, or SSH agent
- ✅ **Lifecycle hooks** - Custom authentication (Pomerium, pod orchestrators, etc.)
- ✅ **Automatic reconnection** - Handles connection drops gracefully
- ✅ **TypeScript first** - Full type safety and IntelliSense support
- ✅ **Flexible architecture** - Support for parallel remote connections
- ✅ **SSH key management** - Built-in helpers for key generation and upload

## Installation

```bash
npm install ssh-hop
```

## Quick Start

```typescript
import { SSHOrchestrator } from 'ssh-hop';
import fs from 'fs';

const remote = new SSHOrchestrator({
  hops: [
    {
      name: 'jump',
      host: 'jump.example.com',
      port: 22,
      username: 'user',
      password: 'password',
    },
    {
      name: 'remote',
      host: '10.0.1.50',
      port: 22,
      username: 'user',
      privateKey: fs.readFileSync('~/.ssh/id_rsa'),
    },
  ],
});

await remote.connect();

// Execute on jump server
const result = await remote.execJump('hostname');

// Execute on remote server
const pods = await remote.execRemote('kubectl get pods');

// SFTP operations
const sftp = await remote.getRemoteSFTP();
await sftp.fastput('./local-file.txt', '/remote/path/file.txt');

await remote.disconnect();
```

## Use Cases

SSH Orchestra is designed for:

- **QA Engineers** - Script operations against remote microservices and databases without application access
- **DevOps** - Automate deployments through bastion hosts and jump servers
- **Security Teams** - Perform operations through zero-trust proxies (Pomerium, etc.)
- **Platform Engineers** - Interact with Kubernetes clusters behind multiple network boundaries

## Core Concepts

### Hops

A "hop" is a server in your SSH tunnel chain. You define hops in order from your local machine to the final destination:

```typescript
hops: [
  { name: 'proxy', host: '127.0.0.1', port: 8888, ... },    // Hop 0
  { name: 'jump', host: 'jump.example.com', ... },           // Hop 1
  { name: 'k8s-cluster', host: '10.0.1.50', ... }            // Hop 2 (final)
]
```

### Execution

Execute commands on **any hop** in the chain:

```typescript
// Execute on specific hop
await remote.exec('jump', 'df -h');

// Convenience methods
await remote.execJump('uptime'); // First hop
await remote.execRemote('kubectl get nodes'); // Final hop
```

### SFTP Access

Get SFTP clients for **any hop** to transfer files:

```typescript
// Get SFTP for specific hop
const jumpSFTP = await remote.getSFTP('jump');
await jumpSFTP.fastput('./config.json', '/etc/app/config.json');

// Convenience methods
const jumpSFTP = await remote.getJumpSFTP(); // First hop
const remoteSFTP = await remote.getRemoteSFTP(); // Final hop
```

## Authentication Methods

### Password Authentication

```typescript
{
  name: 'server',
  host: 'example.com',
  port: 22,
  username: 'user',
  password: 'secret123'
}
```

### Private Key Authentication

```typescript
import fs from 'fs';

{
  name: 'server',
  host: 'example.com',
  port: 22,
  username: 'user',
  privateKey: fs.readFileSync('~/.ssh/id_rsa')
}
```

### SSH Key Setup Helper

Generate and upload SSH keys for passwordless authentication:

```typescript
import { SSHOrchestrator, SSHKeyHelper, consoleLogger } from 'ssh-hop';

// Generate key pair if it doesn't exist
await SSHKeyHelper.generateKeyPair(undefined, consoleLogger);

// Upload to remote server
const sftp = await remote.getJumpSFTP();
await SSHKeyHelper.uploadPublicKey(sftp, 'username', undefined, consoleLogger);
```

## Advanced Features

### Lifecycle Hooks

Use `onHopConnected` to perform custom actions after each hop connects:

```typescript
const remote = new SSHOrchestrator({
  hops: [
    /* ... */
  ],
  onHopConnected: async (index, config) => {
    if (config.name === 'jump') {
      // Authenticate with Pomerium, set up environment, etc.
      await pomerium.start();
    }
    if (config.name === 'k8s-cluster') {
      // Authenticate with pod orchestrator
      await remote.execRemote('robin login user --password pass');
    }
  },
});
```

### Multi-Hop Chains

Connect through any number of servers:

```typescript
const remote = new SSHOrchestrator({
  hops: [
    { name: 'proxy', host: '127.0.0.1', port: 8888, ... },
    { name: 'bastion', host: 'bastion.dmz.com', ... },
    { name: 'jump', host: '10.0.1.1', ... },
    { name: 'k8s-master', host: '10.0.50.100', ... }
  ]
});

// Execute on any hop
await remote.exec('bastion', 'uptime');
await remote.exec('jump', 'df -h');
await remote.exec('k8s-master', 'kubectl get nodes');
```

### Multiple Remotes

Connect to multiple destinations from a single jump server:

```typescript
// Establish jump server
const remote = new SSHOrchestrator({
  hops: [{ name: 'jump', host: 'jump.example.com', ... }]
});
await remote.connect();

// Add multiple remote connections
await remote.addRemote('prod-db', {
  name: 'prod-db',
  host: '10.1.1.50',
  port: 22,
  username: 'qa',
  password: 'pass'
});

await remote.addRemote('staging-k8s', {
  name: 'staging-k8s',
  host: '10.2.1.100',
  port: 22,
  username: 'qa',
  password: 'pass'
});

// Execute on named remotes
await remote.execOnRemote('prod-db', 'mysql -e "SELECT 1"');
await remote.execOnRemote('staging-k8s', 'kubectl get pods');

// SFTP to named remotes
const dbSFTP = await remote.getSFTPFor('prod-db');
await dbSFTP.fastput('./backup.sql', '/tmp/restore.sql');
```

### Custom Logging

Provide your own logger or use the built-in console logger:

```typescript
import { SSHOrchestrator, consoleLogger } from 'ssh-hop';

const remote = new SSHOrchestrator({
  hops: [
    /* ... */
  ],
  logger: consoleLogger, // Or implement LoggerInterface
});
```

Implement the `LoggerInterface`:

```typescript
interface LoggerInterface {
  info(message: string): void;
  error(message: string): void;
  warning(message: string): void;
  success(message: string): void;
  task(message: string): void;
}
```

### Command Builder

Build complex kubectl exec curl commands with a fluent API:

```typescript
import { CommandBuilder } from 'ssh-hop';

const builder = new CommandBuilder();
const cmd = builder
  .pod('my-pod-name')
  .token('bearer-token-here')
  .content('json')
  .payload({ key: 'value' })
  .api('http://localhost:8080/api/endpoint')
  .create();

await remote.execRemote(cmd);
```

## API Reference

### SSHOrchestrator

#### Constructor

```typescript
new SSHOrchestrator(config: OrchestratorConfig | SimplifiedConfig)
```

#### Methods

| Method                                  | Description                          |
| --------------------------------------- | ------------------------------------ |
| `connect()`                             | Establish all SSH tunnel connections |
| `disconnect()`                          | Close all SSH connections            |
| `exec(hopName, cmd, debug?)`            | Execute command on specific hop      |
| `execJump(cmd, debug?)`                 | Execute command on first hop         |
| `execRemote(cmd, debug?)`               | Execute command on final hop         |
| `getSFTP(hopName?)`                     | Get SFTP client for specific hop     |
| `getJumpSFTP()`                         | Get SFTP client for first hop        |
| `getRemoteSFTP()`                       | Get SFTP client for final hop        |
| `addRemote(name, config, fromHop?)`     | Add remote connection from a hop     |
| `execOnRemote(remoteName, cmd, debug?)` | Execute on named remote              |
| `getSFTPFor(remoteName)`                | Get SFTP client for named remote     |
| `openShell(hopName?)`                   | Open interactive shell on hop        |
| `waitForString(stream, expectedString)` | Wait for string in shell output      |

### SFTPClient

#### Methods

| Method                           | Description                |
| -------------------------------- | -------------------------- |
| `fastput(localPath, remotePath)` | Upload file to remote      |
| `fastget(remotePath, localPath)` | Download file from remote  |
| `checkDir(remotePath)`           | Check if path exists       |
| `makeDir(remotePath)`            | Create directory           |
| `appendFile(remotePath, text)`   | Append to file             |
| `readDir(remotePath)`            | List directory contents    |
| `createIfNotExisted(remotePath)` | Create directory if needed |

### SSHKeyHelper

#### Static Methods

| Method                                                     | Description                          |
| ---------------------------------------------------------- | ------------------------------------ |
| `generateKeyPair(keyPath?, logger?)`                       | Generate SSH key pair                |
| `uploadPublicKey(sftp, username, publicKeyPath?, logger?)` | Upload public key to authorized_keys |
| `setupSSHKey(sftp, username, keyPath?, logger?)`           | Complete key setup workflow          |

## Configuration Types

### SSHConfig

```typescript
interface SSHConfig {
  name: string; // Unique identifier
  host: string; // Hostname or IP
  port: number; // SSH port (typically 22)
  username: string; // Username for authentication
  password?: string; // Password authentication
  privateKey?: string | Buffer; // Private key authentication
  readyTimeout?: number; // Connection timeout (default: 60000ms)
}
```

### OrchestratorConfig

```typescript
interface OrchestratorConfig {
  hops: SSHConfig[]; // Array of servers to tunnel through
  logger?: LoggerInterface; // Optional logger
  onHopConnected?: (hopIndex: number, config: SSHConfig) => Promise<void>;
}
```

## Examples

See the [examples/](./examples/) directory for complete working examples:

- **[basic-usage.ts](./examples/basic-usage.ts)** - Simple two-hop connection
- **[with-hooks.ts](./examples/with-hooks.ts)** - Using lifecycle hooks for authentication
- **[multi-hop-chain.ts](./examples/multi-hop-chain.ts)** - 4-hop tunnel chain
- **[multiple-remotes.ts](./examples/multiple-remotes.ts)** - Connect to multiple destinations
- **[ssh-key-setup.ts](./examples/ssh-key-setup.ts)** - Generate and upload SSH keys
- **[robin-integration.ts](./examples/robin-integration.ts)** - Pod orchestrator integration
- **[kafka-operations.ts](./examples/kafka-operations.ts)** - Kafka operations example
- **[pod-discovery.ts](./examples/pod-discovery.ts)** - Kubernetes pod discovery

## Requirements

- Node.js >= 22.0.0
- TypeScript >= 5.0 (for TypeScript users)

## Dependencies

- [ssh2](https://www.npmjs.com/package/ssh2) - SSH2 client for Node.js

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
npm run format
```

### Validate Package Exports

```bash
npm run check:exports
```

## Release Workflow

This package uses automated publishing via GitHub Actions.

### Creating a Release

1. **Make your changes** and commit them
2. **Update the version:**
   ```bash
   npm version patch  # for bug fixes
   npm version minor  # for new features
   npm version major  # for breaking changes
   ```
3. **Push the changes and tags:**
   ```bash
   git push && git push --tags
   ```
4. **Package automatically publishes to npm** 🎉

The GitHub Actions workflow will automatically:

- Run all tests
- Build the package
- Publish to npm when a git tag is pushed

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you encounter any issues, please report them [here](https://github.com/oharu121/ssh-hop/issues).

## License

MIT © oharu121
