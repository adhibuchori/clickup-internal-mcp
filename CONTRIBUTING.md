# Contributing

Thanks for improving clickup-internal-mcp. This page covers the workflow; the rules themselves are
in [AGENTS.md](AGENTS.md) and the design in [docs/architecture.md](docs/architecture.md).

## Set Up

```bash
bun install          # also installs the husky pre-commit hook
bun test             # about a second; no token and no network needed
```

You need Bun 1.4.4+ and git. gitleaks is optional locally (`brew install gitleaks`); CI always runs
it. To try the server against your own workspace, put your token in `.env` (see `.env.example`) and
run `bun run doctor`.

## Workflow

1. Branch from `main` as `internal/<scope>`, e.g. `internal/task-attachments`.
2. Make the change, with tests beside the code in `__tests__/`. ClickUp is the fake in
   `src/testing/mocks/fake-clickup.ts`: add the route or field you need there, with invented data.
3. Run the gates. The pre-commit hook runs them on staged files too:

   ```bash
   bash scripts/check/gates.sh
   ```

4. Commit as `type: description`:
   - `feat:` new behaviour
   - `fix:` a bug
   - `refactor:` the same behaviour
   - `test:`, `docs:`, `ci:` or `chore:` for everything else
5. Add a line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) when users will notice the
   change.
6. Open a pull request. CI must pass **Self Test**, and the pull request is merged with a merge
   commit. Releases follow [RELEASING.md](RELEASING.md).

## What the Gates Check

| Gate | Command |
| ---- | ------- |
| Format | `bun run format:check` (oxfmt) |
| Lint, type-aware | `bun run lint` (oxlint): 200-line files, 40-line functions, layer boundaries, no `any`, no floating promises |
| Types | `bun run type-check` (TypeScript 7, strict) |
| Tests and coverage | `bun run test:coverage`: 100% of lines and functions in every file |
| Coverage policy | `bun run check:coverage-policy`: every exemption explained |
| Comment style | `bun run check:comments`: `/** */` and `/* */` only |
| Dead code | `bun run check:dead-code` (knip) |
| Folder shape | `bun run check:folder-shape`: a folder holds files or folders, and tests mirror sources |
| Module mocks | `bun run check:mocks`: no `mock.module` in test files |
| Double assertion | `bash scripts/check/double-assertion.sh` |
| Secrets | `bash scripts/check/secrets.sh` (gitleaks) |
| README pair | `node scripts/check/readme-pair.mjs --staged`: `README.md` and `README.id.md` change together |
| Version | `bun run check:version`: `package.json` and `CHANGELOG.md` agree |

## Adding a Tool, a Client or a Setting

- **A tool** needs a good reason, because every tool costs tokens on every request. Prefer a new
  mode or argument on an existing tool. See [.claude/rules/mcp/tool-design.md](.claude/rules/mcp/tool-design.md).
- **A client in `setup`** is one entry in `src/config/client-configs.ts`, a test, and a row in
  [docs/clients.md](docs/clients.md). Check the client's own documentation for its config format.
- **A setting** goes in `src/config/settings.ts`, `.env.example`, both READMEs' configuration table,
  and the changelog.

## Measuring a Change

```bash
bun run bench              # 2,000 pages
bun run bench -- 10000     # 10,000 pages
```

[docs/benchmarks.md](docs/benchmarks.md) holds the last results.
