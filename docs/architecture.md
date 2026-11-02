# Architecture

clickup-internal-mcp is a local stdio MCP server. An MCP client starts it as a child process; it
reads ClickUp with the user's personal token and keeps a local cache of what the user tracks.

## Constraints That Shape It

| Constraint | Consequence |
| ---------- | ----------- |
| Personal tokens cannot be scoped | Read-only is enforced in code: the HTTP client sends GET only |
| ClickUp's public API has no text search (Docs or tasks) | Search runs on a local full-text index of tracked content |
| Large workspaces, regulated organisations | Nothing is synced unless tracked; untracked reads stay in memory |
| An admin can revoke personal tokens | Tracked content stays readable from the cache |
| Work is I/O-bound (ClickUp answers in 100–500 ms) | Speed comes from the cache, incremental sync, coalescing and compact answers, not the language |
| Teammates on locked-down laptops | No native modules; one executable per OS; any stdio MCP client |

## Layers

Hexagonal, enforced by oxlint `no-restricted-imports` ([AGENTS.md](../AGENTS.md) §B,
[.claude/rules/architecture/hexagonal.md](../.claude/rules/architecture/hexagonal.md)).

```
src/
  core/         pure: references, Markdown images and embeds, paging, diff, FTS queries, budgets,
                redaction, host rules, time, image sniffing
  ports/        interfaces: ClickUpReader, Stores, AssetFiles, MirrorFiles, Logger, Clock
  engine/       services on ports: docs, tasks, hierarchy, sync, tracking, images, search,
                changes, members, doctor; engine/deps holds EngineDeps
  tools/        one folder per domain: zod input, description, thin run, formatter
  adapters/     clickup (the only HTTP client), store (SQLite + FTS5), files, logger
  config/       settings validation, .env parsing, client setup snippets
  composition/  create-runtime wires everything; index.ts is the CLI; env.ts reads process.env
```

## Data Flow

```
MCP client ──stdio──▶ tool ──▶ engine ──▶ Stores (tracked?) ──yes──▶ format ──▶ answer
                                   │            └──no──▶ ClickUpReader ──▶ Memo (memory) ─┘
                                   └─ track / sync ──▶ ClickUpReader (incremental) ──▶ Stores, assets, mirror
```

- **Docs:** `read_doc` serves a tracked doc from SQLite and re-syncs it first when older than 30
  minutes; an untracked doc is read live (two calls: the doc and all its pages in Markdown) and kept
  in memory for 5 minutes.
- **Tasks:** read live (status changes through the day), memoised for a minute, with the tracked
  copy as a fallback when ClickUp is unreachable.
- **Sync:** a doc costs two calls; unchanged pages cost one hash. Tasks sync incrementally with a
  `date_updated` watermark per scope, 100 per page; comments are fetched for changed tasks only.
- **Images:** downloaded once per URL, stored by SHA-256, linked to pages; a note per image hash.

## The HTTP Client

`src/adapters/clickup/http-client.ts` is the only code that talks to ClickUp:

- GET only; `redirect: 'error'` for the API.
- A limiter: 8 requests in flight and 300 per rolling minute by default.
- Retries: a 429 waits for `X-RateLimit-Reset`; a 5xx or a network error backs off exponentially;
  3 tries, 20-second timeout per request.
- Identical requests in flight share one fetch.
- Image downloads: HTTPS on ClickUp hosts (plus `CLICKUP_ASSET_HOSTS`), redirects checked hop by
  hop, the token sent to ClickUp hosts only, a 25 MB cap.

Responses are parsed leniently with zod (unknown fields pass, times accept strings or numbers); a
response of the wrong shape is reported as an error, never a crash.

## The Cache

`store.db` (SQLite, WAL) in the data folder:

| Table | Holds |
| ----- | ----- |
| `tracked` | scopes, sync time, task watermark, status |
| `docs`, `pages` | the latest copy of tracked docs, with a content hash per page |
| `page_revisions` | every changed page version; pruned after `CLICKUP_CACHE_TTL_DAYS`, keeping the newest |
| `tasks`, `comments`, `task_events` | tracked tasks, their comments, and what changed per sync |
| `assets`, `asset_sources`, `page_assets` | images by hash, the URLs they came from, the pages using them, notes |
| `members` | user names for doc author ids, refreshed at most daily |
| `fts` | FTS5 (`unicode61`, diacritics removed) over pages, tasks and comments |

`SCHEMA_VERSION` in `schema.ts` rebuilds the content tables on change and keeps the tracked list.

## Answers

Text, never JSON. Every reference printed is accepted back as input, and so is any ClickUp URL.
Each answer is redacted and held under a character budget (40,000 by default); `pickLevel` steps
down in detail before anything is cut, and long content pages with a cursor.

## Not Built

- **Writing to ClickUp.** The port has no write method. A writer would be a separate port, wired
  only behind an explicit setting, with a list allowlist, an audit log and no delete; it changes
  AGENTS.md Rule 52 first and needs its own security approval.
- **A remote (HTTP) server** for web clients (claude.ai, ChatGPT, ClickUp Brain). It moves the token
  off the user's laptop and needs authentication; a separate decision.
