# clickup-internal-mcp — Claude Code Config

> Read [AGENTS.md](AGENTS.md) for the numbered rules.

## Project Snapshot

A local MCP server (stdio) that lets any MCP client (Claude, Cursor, VS Code, Gemini CLI, Codex
CLI…) read a ClickUp workspace through the user's own personal token, built for gathering
requirements from ClickUp Docs and tasks. TypeScript on Bun
(Node 22.18+ as a fallback), with the MCP SDK, zod and SQLite FTS5 (`bun:sqlite` / `node:sqlite`).
No other runtime dependency.

- Run: `bun start` (stdio), `bun run setup`, `bun run doctor`, `bun run purge -- --yes`.
- Client snippets: `src/config/client-configs.ts`; guide in [docs/clients.md](docs/clients.md).
- Tools are described in [docs/tools.md](docs/tools.md), the design in
  [docs/architecture.md](docs/architecture.md), measurements in [docs/benchmarks.md](docs/benchmarks.md).
- Releases: [RELEASING.md](RELEASING.md). Operational facts: [.claude/OPERATIONS.md](.claude/OPERATIONS.md).

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

## Hooks

- **PreToolUse `block-env.py`** blocks any access to `.env` files.
- **PostToolUse `post-edit.ts`** formats the file you just wrote, then lints it and checks its
  comment style. Findings come back as context. It never blocks.

## Conventions

- **Language.** Reply in the language the user writes in. Code, comments, commits, pull requests
  and docs are in English. README.md and README.id.md change together.
- **Comments.** `/** */` for a file or a declaration and `/* */` for other notes. Never `//`.
- **Names.** Files are kebab-case. Tools are `<name>.tool.ts`, services `<domain>.service.ts`,
  formatters `<domain>.format.ts`, type-only files `*.types.ts`.
- **Commits.** `type: description` (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`).
  No `Co-Authored-By` or other attribution trailer, and no "Generated with" line in pull requests.
- **Branches.** `internal/<scope>`. Open a pull request, wait for the **Self Test** check, and merge
  with a merge commit.
- **Versioning.** Add a line under `[Unreleased]` in `CHANGELOG.md` for what users notice; a release
  bumps `package.json` as in [RELEASING.md](RELEASING.md). `bun run check:version` verifies both.
- **Package manager.** Bun (`bun install`, `bun add`).
- **No company data in the repo.** No workspace ids, names or content in code, tests, fixtures or
  docs. Fixtures are invented.

## Context Loading

| Task | Load |
| ---- | ---- |
| Any code change | `.claude/rules/architecture/hexagonal.md`, `.claude/rules/common/folder-shape.md` |
| A tool's input, output or description | `.claude/rules/mcp/tool-design.md` |
| ClickUp calls, the token, downloads, what is written to disk | `.claude/rules/security/read-only.md` |
| Client setup snippets | `docs/clients.md`, `src/config/client-configs.ts` |
| Tests and coverage | `.claude/rules/typescript/coverage.md` |
| Lint config | `.claude/docs/lint-config.md` |
| Running it, settings, data folder | `.claude/OPERATIONS.md` |
| Something that broke before | `.claude/anti-patterns/INDEX.md` |
