# Changelog

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
