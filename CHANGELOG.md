# Changelog

## 0.2.0 — 2026-11-02

Works from any MCP client, not only Claude.

- `setup` command (in the executable and `bun run setup`) prints ready-to-paste config for Claude
  Desktop, Claude Code, Cursor, Windsurf, VS Code, Gemini CLI, Codex CLI and any stdio client,
  with absolute paths, so GUI apps on macOS that do not see the shell PATH still start it.
- `setup` runs before any token is configured.
- A compiled executable also reads `clickup-internal-mcp.env` beside it (easier than `.env` on
  Windows).
- docs/clients.md: per-client guide and a step-by-step guide for teammates who do not write code.
- READMEs no longer assume Claude.

## 0.1.0 — 2026-11-02

First version.

- Nine read-only tools: `browse`, `read_doc`, `read_task`, `list_tasks`, `search`, `track`,
  `changes`, `view_image`, `note_image`.
- Local cache of tracked docs, tasks and comments in SQLite with FTS5, incremental task sync,
  page revisions with line diffs, and task change events.
- Images downloaded once by content hash, notes saved per image, optional Markdown mirror.
- Traffic shaping (8 in flight, 300 per minute), retries honouring `X-RateLimit-Reset`, request
  coalescing, host allowlist for downloads, secret redaction on every answer.
- `doctor`, `purge`, `spike`, `setup`, `build` (single-file executables) and `bench`.
