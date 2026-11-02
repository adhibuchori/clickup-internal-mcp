# Benchmarks

`bun run bench [pages]` measures the latency the server adds, through a real MCP client and server,
against the fake ClickUp API (no network). ClickUp's own latency (typically 100–500 ms per call)
comes on top of every live read; cached reads and searches never call ClickUp.

Measured on 2026-11-02, Apple Silicon laptop, Bun 1.4.4, one doc with N pages of 60 words each.

| Case | 2,000 pages p50 / p95 | 10,000 pages p50 / p95 | Target |
| ---- | --------------------- | ---------------------- | ------ |
| First sync of the doc | 251 ms | 5,362 ms | — |
| `read_doc` one page, cache hit | 1.08 / 2.01 ms | 6.56 / 7.72 ms | < 50 ms |
| `read_doc` outline, cache hit | 2.23 / 3.60 ms | 13.10 / 14.27 ms | < 50 ms |
| `search`, two words | 7.29 / 7.52 ms | 50.17 / 50.92 ms | < 100 ms |
| `search`, one word prefix | 6.78 / 7.03 ms | 48.63 / 49.37 ms | < 100 ms |
| `read_task`, memo after first read | 0.09 / 0.11 ms | 0.09 / 0.11 ms | — |

Notes:

- A cached page read loads every page of its doc to keep page order; a 10,000-page doc is far
  beyond real requirement docs, which stay well inside the 2,000-page column.
- Search time grows with the number of matching rows, since every match is ranked.
