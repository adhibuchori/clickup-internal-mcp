---
paths:
  - 'src/adapters/store/**'
  - 'src/core/search/**'
---

# FTS5 With `detail = 'none'` Rejects Phrase Queries

**Symptom.** After shrinking the `fts` table with `detail = 'none'` (or `'column'`), every search
with a quoted phrase, and every multi-word term built by `toFtsQuery`, fails with `fts5: phrase
queries are not supported (detail!=full)`. Single words still work, so it looks intermittent.

**Cause.** Phrase and NEAR queries need token positions, which only `detail = 'full'` (the default)
stores. codebase-mcp hit this on its trigram shards, where `detail = 'none'` was worth the space.

**Fix here.** The `fts` table in `src/adapters/store/schema.ts` keeps the default `detail = 'full'`:
requirement text is small, and `search` relies on phrases (`"daily limit"`). If size ever matters,
measure first and keep phrase support, or make `toFtsQuery` drop quotes for that table.

**Signal it is back.** A `detail =` option in the `CREATE VIRTUAL TABLE fts` statement, or search
tests with quoted phrases starting to fail.
