# Changelog

All notable changes to clickup-internal-mcp are listed here. The format follows
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). A **Breaking:** line marks a change
you have to act on. How a release is made: [RELEASING.md](RELEASING.md).

## [Unreleased]

### Added

- `version` command, and `doctor` prints the version first, so a bug report can name it.
- Release process ([RELEASING.md](RELEASING.md)) with `bun run check:version`, which keeps
  `package.json` and this file in step.
- CI on every pull request (Self Test): gates, tests on macOS and Windows, the Node runtime, the
  compiled executable on Windows and macOS, secret scan and workflow lint; CodeQL and dependency
  review when GitHub Code Security is available.
- Contributor docs: CONTRIBUTING, SECURITY (private vulnerability reporting), CODE_OF_CONDUCT,
  docs/architecture.md, issue and pull request templates, CODEOWNERS.

## [0.2.0] - 2026-11-02

### Added

- `setup` command (in the executable and `bun run setup`) that prints ready-to-paste config for
  Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, Gemini CLI, Codex CLI and any stdio
  client. It runs before a token is configured.
- A compiled executable also reads `clickup-internal-mcp.env` beside it, easier to create than
  `.env` on Windows.
- docs/clients.md: a guide per client and a step-by-step guide for teammates who do not write code.

### Changed

- The READMEs no longer assume Claude: the server works from any MCP client with stdio support.

### Fixed

- Client config used a bare `bun` command, which GUI apps on macOS cannot find because they do not
  see the shell's PATH. Commands are absolute paths now.

## [0.1.0] - 2026-11-02

### Added

- Nine read-only tools: `browse`, `read_doc`, `read_task`, `list_tasks`, `search`, `track`,
  `changes`, `view_image`, `note_image`.
- Local cache of tracked docs, tasks and comments in SQLite with FTS5, incremental task sync, page
  revisions with line diffs, and task change events.
- Images downloaded once by content hash, a note per image, and an optional Markdown mirror.
- Quiet traffic (8 requests in flight, 300 per minute), retries that honour `X-RateLimit-Reset`,
  request coalescing, a host allowlist for downloads, and secret redaction on every answer.
- `doctor`, `purge`, `spike`, `setup`, `build` (single-file executables) and `bench`.

[Unreleased]: https://github.com/adhibuchori/clickup-internal-mcp/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/adhibuchori/clickup-internal-mcp/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/adhibuchori/clickup-internal-mcp/releases/tag/v0.1.0
