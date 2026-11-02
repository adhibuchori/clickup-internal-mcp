---
paths:
  - 'src/config/**'
  - 'scripts/setup/**'
---

# GUI MCP Clients on macOS Do Not See the Shell's PATH

**Symptom.** The server works from a terminal and from Claude Code, but Claude Desktop or Cursor
shows it as failed to start, with "command not found" or no log at all.

**Cause.** Apps started from the Dock or Finder get launchd's minimal PATH, not the one your shell
profile builds. A config with `"command": "bun"` works only where `bun` is on that minimal PATH.

**Fix.** `setup` prints absolute paths: `process.execPath` for the runtime (or the executable
itself) and an absolute entry file. Never print a bare program name in a client snippet.

**Signal it is back.** A snippet with a bare `bun`, `node` or `npx` as the command. The CI smoke
tests start the server with a stripped environment to catch it.
