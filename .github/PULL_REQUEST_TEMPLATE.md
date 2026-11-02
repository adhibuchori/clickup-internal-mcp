## What and Why

<!-- The problem this solves, then what changed. Link the issue: Fixes #123. -->

## Checklist

- [ ] **Gates** pass locally: `bash scripts/check/gates.sh`. The pre-commit hook ran them on the
      staged files.
- [ ] **Tests** prove the change, including the case that must fail (a refused reference, a ClickUp
      error, a bad argument), and every touched file stays at 100% lines and functions.
- [ ] **CHANGELOG.md** has an entry under `## [Unreleased]` when users will notice the change,
      with a **Breaking:** line if they must act. A release bumps `package.json`
      ([RELEASING.md](../RELEASING.md)).
- [ ] **Measured**, when budgets, formats, sync or search changed: `bun run bench` before and
      after, with the result below.
- [ ] **Docs**: `README.md` and `README.id.md` changed together; `docs/tools.md` matches any tool
      change; `docs/clients.md` matches any `setup` change.
- [ ] **Read-only toward ClickUp**: no verb but GET in `src/adapters/clickup/`, no new host the
      token is sent to, and only tracked content is written to disk.
- [ ] **No company data**: no real workspace ids, names, docs, tasks or tokens in code, fixtures,
      docs or this description.

## How to Check It

<!-- Commands a reviewer can paste, and what they should print. -->

## Benchmark

<!-- bun run bench: the table before and after, when it applies. -->
