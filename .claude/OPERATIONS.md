# Operations

Operational facts for running clickup-internal-mcp. The working agreements point here; the README
holds the full setup.

| Fact | Value |
| ---- | ----- |
| Server | stdio only: the MCP client starts it (`bun src/index.ts`, or the executable with no argument) |
| Commands | `setup [--client <id>]`, `doctor`, `version`, `purge --yes` (`bun run …` from a checkout) |
| Settings | `CLICKUP_ENV_FILE`, else `.env` in the checkout, else `.env` or `clickup-internal-mcp.env` beside the executable, else `.env` in the data folder. The environment wins over the file. |
| Token | Personal ClickUp token named `clickup-mcp`, one per person, never shared. Revoke in ClickUp → Settings → Apps. |
| Data folder | `~/Library/Application Support/clickup-internal-mcp` (macOS), `%LOCALAPPDATA%\clickup-internal-mcp` (Windows); `store.db` and `assets/`. Safe to delete: `purge --yes`. |
| Traffic | 8 in flight, 300 per minute by default (`CLICKUP_MAX_CONCURRENCY`, `CLICKUP_MAX_RPM`) |
| Logs | stderr, shown in the MCP client's server log; `LOG_LEVEL=debug` adds one line per ClickUp call |
| End-to-end check | `doctor` (token, workspace, cache, mirror, time zone); `bun run spike -- --doc <id>` prints real API shapes only |
| Executables | `bun run build`; released with the GitHub release (RELEASING.md) |

The only secret is the ClickUp token, in the settings file. Never read, print or paste it.
