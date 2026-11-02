# Anti-Patterns Index

> Lazy-loaded knowledge base. Load only the file(s) matching your current task. Each file is
> self-contained: symptom, cause, fix, and the signal that it is back.

## Loading Guide

| Trigger / task | Load |
| -------------- | ---- |
| Writing an FTS5 `MATCH` query or changing the `fts` table in src/adapters/store/ | fts5-detail-none-rejects-phrases.md |
| Opening, caching or closing SQLite connections; `EBUSY` on `store.db` on Windows | bun-sqlite-close-keeps-zombie.md |
| Writing a `bun test` file that needs a module replaced | bun-mock-module-is-process-wide.md |
| `await-thenable` on `expect(...).rejects` in a test | bun-expect-rejects-await-thenable.md |
| Writing or editing any check under scripts/check/ | a-check-that-matches-nothing-passes.md |
| Adding a lint ignore, or lint flags files it should skip | oxlint-ignores-oxlintignore.md |
| Coverage shows a lone `);` uncovered after oxfmt wrapped a `throw` | bun-coverage-final-multiline-throw.md |
| knip reports an unresolved import in a script that starts a program | knip-reads-spawn-arguments-as-scripts.md |
| Adding a timer, a timeout or a retry to the engine | one-timer-for-retry-and-wait.md |
| Changing client snippets in `setup`, or a client cannot start the server | gui-clients-do-not-see-shell-path.md |

## When to Add an Entry

- It cost real debugging time (more than 30 minutes).
- The root cause is not obvious from reading the code or the docs.
- The same trap is likely to come back (a vendor quirk, an environment difference, a tool gotcha).

When the cause is fixed upstream, delete the file instead of leaving a stale entry. File names are
`<scope>-<short-description>.md`, kebab-case.
