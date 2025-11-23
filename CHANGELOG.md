# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0]

### Added
- Initial release of ssh-hop
- Multi-hop SSH tunneling through arbitrary-length server chains
- Execute commands on any hop in the tunnel chain
- SFTP operations to any server in the tunnel
- Multiple authentication methods (password, private key, SSH agent)
- Automatic reconnection handling
- Full TypeScript support with comprehensive type definitions
- Lifecycle hooks (`onHopConnected`) for custom authentication flows
- Support for parallel remote connections from a single jump server
- Built-in SSH key management helpers (generation and upload)
- Command builder utility for kubectl exec curl commands
- Flexible logger interface with console logger implementation
- Comprehensive test suite (130 tests with 100% core coverage)

### Package Structure
- Core orchestration in `SSHOrchestrator` class
- SFTP operations in `SFTPClient` class
- Kubectl command building in `CommandBuilder` class
- SSH key utilities in `SSHKeyHelper` class
- Type-safe configuration interfaces
- Example implementations for common use cases

### Documentation
- Complete API reference
- Quick start guide
- Multi-hop configuration examples
- Authentication method examples
- Advanced feature demonstrations
- Integration examples (Kafka, Robin, Kubernetes)

## [0.1.0] - 2025-01-24

### Changed
- Renamed package from `ssh-orchestra` to `ssh-hop` for better discoverability
- Refactored codebase to remove business-specific logic
- Made external dependencies (Logger, SessionDB, Pomerium) optional via configuration
- Updated README with comprehensive documentation
- Enhanced ESLint configuration for better code quality
- Fixed all linting issues

### Fixed
- Windows path separator compatibility in tests
- Module mocking issues in SSHKeyHelper tests
- Unused variable warnings
- Form metadata escaping in CommandBuilder tests

### Testing
- 130 comprehensive tests across all components
- Unit tests for SSHOrchestrator, SFTPClient, CommandBuilder, SSHKeyHelper
- Integration tests verifying public API and type safety
- Mock utilities for consistent test setup
- Path-agnostic test assertions for cross-platform compatibility

### Package Metadata
- Updated package name to `ssh-hop`
- Added comprehensive keywords for npm discoverability
- Updated repository URLs to reflect new name
- Added badges for version, license, types, downloads, CI status

[Unreleased]: https://github.com/oharu121/ssh-hop/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/oharu121/ssh-hop/releases/tag/v0.1.0
