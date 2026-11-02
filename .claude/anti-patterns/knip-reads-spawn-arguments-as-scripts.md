---
paths:
  - 'scripts/**'
---

# knip Reads `spawnSync('bun', [...])` as a Package Script

**Symptom.** `bun run check:dead-code` reports `Unresolved imports: scripts/build/build.ts` pointing
at the script itself, although every import in it resolves.

**Cause.** knip parses child-process calls whose command is a string literal (`spawnSync('bun',
['build', …])`) as shell scripts, and treats the arguments of `bun build` as entry files to resolve.
An argument built at runtime (`resolve(root, 'src', 'index.ts')`) cannot be resolved, so it is
reported as an unresolved import of the calling file.

**Fix.** Start the running runtime by its path instead of a literal name:
`spawnSync(process.execPath, ['build', …])`. It is also more correct: it uses the same Bun that runs
the script, not whichever `bun` is first on PATH.

**Signal it is back.** An "unresolved import" whose file is a script that starts another program.
