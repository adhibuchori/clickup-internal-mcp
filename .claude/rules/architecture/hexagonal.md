---
paths:
  - 'src/**'
---

# Hexagonal Layout

`AGENTS.md` §B holds the numbered rules; this file explains the layout they protect. Lint enforces
every import boundary below (`.oxlintrc.json` overrides with `no-restricted-imports`).

| Layer | Folder | May import | Never imports |
| ----- | ------ | ---------- | ------------- |
| Domain | `src/core/` | other `core/`, zod | I/O (`node:fs`, `node:http`), `bun:*`, the MCP SDK, any outer layer |
| Ports | `src/ports/` | types from `core/` | anything at runtime (type-only files) |
| Application | `src/engine/` | `core/`, `ports/`, `node:crypto` | `adapters/`, `tools/`, `composition/`, `node:fs`, the MCP SDK |
| Tools | `src/tools/` | `core/`, `engine/`, `ports/`, the MCP SDK (registry only) | `adapters/`, `composition/`, `node:fs` |
| Adapters | `src/adapters/` | `core/`, `ports/`, Node and Bun APIs | `tools/`, `engine/`, `composition/` |
| Config | `src/config/` | `core/`, zod | — |
| Composition | `src/composition/`, `src/index.ts`, `src/env.ts` | everything | — |

## Why This Shape

- **One port per outside system.** ClickUp is `ClickUpReader`, the cache is `Stores`, files are
  `AssetFiles` and `MirrorFiles`. The engine never knows it is talking HTTP or SQLite, so tests swap
  in the fake ClickUp and a temporary folder without replacing modules.
- **Read-only is a property of the port.** `ClickUpReader` has no write method, so no engine or tool
  code can change ClickUp whatever it is asked.
- **Pure logic is cheap to test.** References, Markdown, diff, FTS queries, budgets and redaction
  live in `core/` and are tested without a file system.

## A Tool, Start to Finish

`src/tools/<domain>/<name>.tool.ts` declares the input (zod), the description (3–4 sentences and an
example, under 2,048 characters) and a thin `run` (≤ 15 lines) that calls the engine and renders
through a `<domain>.format.ts`. Register it in `src/tools/registry/build-server.ts`; `defineTool`
adds the annotations, redaction, the response budget and the error contract.

## Dependency Injection

No container. `src/composition/create-runtime.ts` builds the adapters and hands an `EngineDeps`
object down. Tests build the same runtime with `startTestRuntime` (`src/testing/helpers/`), never
`mock.module` (see `.claude/anti-patterns/bun-mock-module-is-process-wide.md`).
