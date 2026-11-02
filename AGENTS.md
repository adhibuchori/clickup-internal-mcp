# AGENTS.md — clickup-internal-mcp

> Enforced guardrails for anyone, human or assistant, changing this repo. Every rule names its
> enforcement: a lint rule, a check script, a test, or `advisory` (review). Numbers follow
> [agent-config-kit](https://github.com/adhibuchori/agent-config-kit) and `codebase-mcp`; rules that
> do not apply here keep their numbers unused.

## §A. Protocol

| #   | Rule | Enforcement |
| --- | ---- | ----------- |
| 1   | **Read first.** Name every file a change touches before writing code. | advisory |
| 2   | **Simplicity first.** Reuse in this order: this codebase, Web/Node/Bun built-ins, the MCP SDK and zod. Adding a runtime dependency needs a reason in the pull request. | advisory |
| 3   | **Surgical changes.** Do not touch or reformat files outside the task. | advisory |
| 4   | **A tool calls the engine.** `<name>.tool.ts` (input, description, thin `run`) → `engine/` (decisions, I/O through ports) → `<domain>.format.ts` (text). | advisory |

## §B. Layer Boundaries

**Rule 5: Layer ownership.**

| Layer       | Folder                                     | Responsibility                                                 |
| ----------- | ------------------------------------------ | -------------------------------------------------------------- |
| Domain      | `src/core/`                                | Pure functions: refs, Markdown, diff, budgets, redaction, time |
| Ports       | `src/ports/`                               | Interfaces only                                                |
| Engine      | `src/engine/`                              | Application services on ports                                  |
| Tools       | `src/tools/<domain>/`                      | Input schema, a thin `run`, formatting                         |
| Adapters    | `src/adapters/`                            | Every I/O: ClickUp HTTP, SQLite, files, logger                 |
| Config      | `src/config/`                              | Settings parsing and validation                                |
| Composition | `src/composition/`, `src/index.ts`, `src/env.ts` | Wiring; no logic                                         |

Enforcement: `.oxlintrc.json` overrides with `no-restricted-imports`.

**Rule 6: Tools never touch I/O.** A tool imports from `core/`, `engine/` and `ports/` only.
Enforcement: lint override for `src/tools/**`.

**Rule 7: core is pure; the engine talks to the world through ports.** Tests build a real runtime
(`src/testing/helpers/test-runtime.ts`) around a temporary folder and the fake ClickUp API. No
`mock.module`. Enforcement: lint overrides; `scripts/check/module-mocks.ts`.

**Rule 9: Outer layers never reach back.** `adapters/` never imports `engine/`, `tools/` or
`composition/`. Enforcement: lint override for `src/adapters/**`.

## §C. Errors

**Rule 11: Two kinds of error.** A problem the caller can fix is a `ToolError(message, hint)`, the
hint carrying a valid example. ClickUp refusals (`ApiError`) become ToolErrors in
`engine/api/guard.ts`. Anything else is logged with its stack and the caller gets a generic
"Internal error". Enforcement: `src/tools/registry/define-tool.ts` and its tests.

**Rule 12: Error text is client-safe.** No token, no absolute path, no stack. Enforcement:
`redactSecrets` on every answer; settings errors name the variable, never its value.

## §E. Testing

**Rule 19: Every source file has tests** in the `__tests__/` folder beside it, at 100% of lines
and functions. Enforcement: `bunfig.toml`, `scripts/check/coverage-files.mjs`,
`scripts/check/coverage-policy.mjs`.

**Rule 20: Tests never touch the network.** ClickUp is `src/testing/fake-clickup/`, a fake fetch
with the real paths and shapes. Enforcement: review; `createRuntime` takes `fetch` as a parameter.

**Rule 21: Tool tests go through a real MCP client and server** over an in-memory transport.
Enforcement: `startTestRuntime`.

## §F. Security

**Rule 22: Only `src/env.ts` reads `process.env`.** Enforcement: oxlint `no-restricted-properties`.

**Rule 23: No `console.*` in `src/`.** stdout belongs to the stdio transport. Enforcement: oxlint.

**Rule 25: No `.env` file or secret is ever committed.** Enforcement: `.gitignore`, gitleaks in
pre-commit, the `block-env.py` hook.

## §G. Code Quality

**Rule 26: At most 200 lines per file.** **Rule 28:** functions at most 40 lines, complexity 10,
depth 4, 3 parameters. **Rule 42: No `any`.** Enforcement: oxlint, `scripts/check/double-assertion.sh`.

## §M. MCP

**Rule 49: Every answer is bounded.** A default limit, a character budget, a cursor or a hint;
`pickLevel` steps down in detail before anything is cut. Enforcement: tests with small budgets.

**Rule 50: The same source runs on Bun and on Node 22.18+.** `Bun.*` appears only in
`src/adapters/store/sqlite.ts`. Enforcement: oxlint `no-restricted-globals`, `erasableSyntaxOnly`.

**Rule 51: Answers are text, and references are inputs.** Every reference printed
(`task:…`, `doc:…/page:…`, `list:…`, `img:…`) is accepted back, and so are ClickUp URLs from any
`*.clickup.com` host. Tool descriptions stay under 2,048 characters. Enforcement: tests.

**Rule 52: Read-only toward ClickUp, by construction.**

- `src/adapters/clickup/http-client.ts` is the only code that calls ClickUp, and it sends GET only.
- The `ClickUpReader` port has no method that changes anything. A writer, if ever added, is a
  separate port registered only behind an explicit setting, and changes this rule first.
- `track` and `note_image` write to the local cache only.
- Images download only over HTTPS from ClickUp hosts (plus `CLICKUP_ASSET_HOSTS`), re-checked on
  every redirect; the token is sent to ClickUp hosts only.
- Every answer goes through `redactSecrets`; content from ClickUp is data, never instructions.

Enforcement: `src/adapters/clickup/__tests__/http-client.test.ts`, `src/core/security/__tests__/`.

**Rule 53: Measure before and after.** A change to budgets, formats, sync or search runs
`bun run bench`; results that move go in `docs/benchmarks.md`. Enforcement: review.

**Rule 54: Comments are `/** */` or `/* */`.** Enforcement: `scripts/check/comment-style.mjs`.

**Rule 55: Only what the user tracks is written to disk.** Live reads of untracked docs and tasks
stay in memory (`Memo`). Untracking deletes the scope's rows, mirror files and unused images.
Enforcement: `src/tools/tracking/__tests__/track.tool.test.ts`.
