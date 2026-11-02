# clickup-internal-mcp — Claude Code Config

> Read [AGENTS.md](AGENTS.md) for the numbered rules.

## Project Snapshot

A local MCP server (stdio) that lets Claude read a ClickUp workspace through the user's own
personal token, built for gathering requirements from ClickUp Docs and tasks. TypeScript on Bun
(Node 22.18+ as a fallback), with the MCP SDK, zod and SQLite FTS5 (`bun:sqlite` / `node:sqlite`).
No other runtime dependency.

- Run: `bun start` (stdio), `bun run doctor`, `bun run purge -- --yes`.
- Tools are described in [docs/tools.md](docs/tools.md), the design in [docs/plan.md](docs/plan.md),
  measurements in [docs/benchmarks.md](docs/benchmarks.md).

## Quality Gates

Run them before you say a change is done:

```bash
bun run fl                    # oxfmt + oxlint (type-aware)
bun run type-check            # tsc 7, strict
bun run test:coverage         # 100% lines and functions per file
bash scripts/check/gates.sh   # all of it, plus comments, knip, folder shape, mocks, secrets, README pair
```

A change to budgets, formats, sync or search also runs `bun run bench`.

## `.env` Files

Never read, print or edit any `.env` file: it holds the user's ClickUp token. The `block-env.py`
hook refuses tool calls that name one, and settings deny reading them. `.env.example` is fine.
Tests build fake tokens at runtime.

## Conventions

- **Language.** Reply in the language the user writes in. Code, comments, commits, pull requests
  and docs are in English. README.md and README.id.md change together.
- **Comments.** `/** */` for a file or a declaration and `/* */` for other notes. Never `//`.
- **Names.** Files are kebab-case. Tools are `<name>.tool.ts`, services `<domain>.service.ts`,
  formatters `<domain>.format.ts`, type-only files `*.types.ts`.
- **Commits.** `type: description` (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`).
- **Package manager.** Bun (`bun install`, `bun add`).
- **No company data in the repo.** No workspace ids, names or content in code, tests, fixtures or
  docs. Fixtures are invented.
