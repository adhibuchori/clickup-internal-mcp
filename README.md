# clickup-internal-mcp

Read your ClickUp workspace from Claude (Claude Code or Claude Desktop) through **your own personal
token**, when the official ClickUp MCP is not available to you. Built first for **gathering
requirements** from ClickUp Docs and tasks, and general enough for any ClickUp lookup.

[Bahasa Indonesia](README.id.md)

- **Read-only toward ClickUp, by construction.** The only code that calls ClickUp sends GET
  requests. Nothing can create, change or delete anything in ClickUp.
- **Fast.** What you track is cached locally with a full-text index: a cached page reads in a
  few milliseconds, a search over 10,000 pages in about 50 ms ([measurements](docs/benchmarks.md)).
- **Quiet.** At most 8 requests in flight and 300 per minute by default, far below ClickUp's limits.
- **Minimal data on disk.** Only what you track is stored. Everything else is read live and kept in
  memory for a few minutes.
- **Images handled.** Mockups in docs are downloaded once. Claude looks at each one once and saves
  a description, so later reads stay text-only.

## Setup

Requirements: [Bun](https://bun.sh) 1.3+ (or Node 22.18+), and a ClickUp account.

1. **Create a token.** ClickUp → Settings → Apps → API tokens → **Create token**. Name it
   `clickup-mcp`, so you know which one to revoke.
2. **Install and configure.**

   ```bash
   bun install
   cp .env.example .env    # then put the token and the workspace id in .env
   ```

   The workspace id is the number right after the host in any ClickUp URL
   (`https://app.clickup.com/<workspace id>/...`). Never paste the token into a chat.

3. **Check.** `bun run doctor` confirms the token, the workspace and the cache folder, without
   printing the token.
4. **Register with Claude.** `bun run setup` prints the exact `claude mcp add` command and the
   Claude Desktop JSON for this checkout.

### For Teammates Without Bun

`bun run build` makes single-file executables in `dist/` (macOS arm64/x64, Windows x64, Linux x64).
Each person creates **their own token**; tokens are never shared. Put `.env` next to the executable
(or point `CLICKUP_ENV_FILE` at it), run `<executable> doctor`, then
`bun run setup -- --binary <path>` shows how to register it.

## Tools

| Tool | What it does |
| ---- | ------------ |
| `browse` | Spaces → folders → lists, and the docs under each. |
| `read_doc` | A doc's outline, one page, or every page, as Markdown. Images appear as `img:` references with their saved note; Figma and whiteboard links are listed. |
| `read_task` | A task in full: status, people, dates, description, custom fields, subtasks, attachments, comments. |
| `list_tasks` | Tasks of a list, folder or space, filtered by status, assignee (`me`), tag, update and due dates. |
| `search` | Full-text search over everything you track. ClickUp's API has no text search, so this is local. |
| `track` | Choose what is cached: add, remove, list, sync a doc, list, folder or space. |
| `changes` | What changed in tracked content since your last look or a date: page diffs and task events. |
| `view_image` | Shows one image to Claude. |
| `note_image` | Saves Claude's description of an image, reused until the image changes. |

Every tool accepts ClickUp URLs (any `*.clickup.com` host) and the references the others print
(`task:86c1abcde`, `task:ABC-123`, `doc:…/page:…`, `list:…`). Details: [docs/tools.md](docs/tools.md).

## Gathering Requirements, Step by Step

1. Paste a doc URL: *"Read this doc and list the requirements."* Claude calls `read_doc`.
2. If you will come back to it: *"Track this doc."* Its pages and images are cached and searchable.
3. Mockups: *"Describe the images that have no note yet."* Claude opens each image once with
   `view_image` and saves the description with `note_image` (screen, fields, labels, actions,
   states, text).
4. Ask for structure: user stories, acceptance criteria, business rules, dependencies, and **open
   questions**, including mismatches between the text and the mockups, each with its reference.
5. Later: *"What changed in the requirements since last week?"* `changes` shows page diffs and
   task events.

## Data and Privacy

- **Where:** `~/Library/Application Support/clickup-internal-mcp` on macOS,
  `%LOCALAPPDATA%\clickup-internal-mcp` on Windows (`CLICKUP_DATA_DIR` changes it). Created with
  owner-only permissions. Encryption at rest relies on FileVault or BitLocker.
- **What:** only tracked scopes (pages, tasks, comments, images, notes) plus member names.
  Revisions and task events older than `CLICKUP_CACHE_TTL_DAYS` (30) are dropped.
- **Remove:** `track` with `remove` deletes one scope; `bun run purge -- --yes` deletes everything.
- **Sent where:** only to `api.clickup.com` and ClickUp's attachment hosts. No telemetry. What
  Claude reads goes to Anthropic as part of your conversation, like anything else you share.
- **Redaction:** tokens, keys and passwords that people pasted into docs or comments are masked in
  every answer.
- **Optional mirror:** `CLICKUP_MIRROR_DIR` also writes tracked docs as Markdown files with their
  images, for reading or `git diff` outside Claude.

## Configuration

All settings live in `.env` (see [.env.example](.env.example)); the environment wins over the file.

| Setting | Default | Meaning |
| ------- | ------- | ------- |
| `CLICKUP_API_TOKEN` | required | Your personal token. |
| `CLICKUP_WORKSPACE_ID` | required | The number after the host in a ClickUp URL. |
| `CLICKUP_DATA_DIR` | per OS, above | Where the cache lives. |
| `CLICKUP_MIRROR_DIR` | off | Also write tracked docs as Markdown files. |
| `CLICKUP_CACHE_TTL_DAYS` | 30 | Age at which old revisions and events are dropped. |
| `CLICKUP_MAX_CONCURRENCY` | 8 | Requests in flight (1–16). |
| `CLICKUP_MAX_RPM` | 300 | Requests per minute. |
| `CLICKUP_ASSET_HOSTS` | none | Extra image host suffixes, comma-separated. |
| `CLICKUP_TIMEZONE` | system | Time zone for dates (due dates are local days). |
| `LOG_LEVEL` | info | `debug`, `info`, `warn` or `error` (stderr). |

## Limits

- ClickUp's public API has **no text search**: `search` covers tracked content only.
- Tasks deleted in ClickUp stay in the cache until their scope is untracked.
- `read_task` shows the comments ClickUp returns in one request (the most recent ones).
- Whiteboards and Figma files are listed as links, not read.
- Doc Markdown comes from ClickUp's own conversion; some embeds do not survive it.

## Development

See [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md). `bash scripts/check/gates.sh` runs
formatting, lint, type-check, dead code, folder shape, secrets and the test suite at 100% coverage.
Tests never touch the network: ClickUp is a fake with the real paths and shapes.
`bun run spike -- --doc <doc id>` checks the real API's shapes (printing shapes only, never content).
