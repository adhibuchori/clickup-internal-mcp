---
paths:
  - 'src/adapters/store/**'
---

# bun:sqlite `close()` Leaves a Zombie Connection While a Statement Lives

**Symptom.** On Windows, deleting the cache database (`purge`, a test's temporary folder) fails with `EBUSY: resource busy or
locked` after the connection was "closed". It shows up first as tests failing to remove their
temporary folders. On macOS and Linux nothing shows: an open file can be deleted there, so the leak
only costs handles and memory.

**Cause.** `Database.close()` in bun:sqlite uses `sqlite3_close_v2`. While any prepared statement
is unfinalized, SQLite keeps the connection alive as a zombie, with its file, WAL and shared memory
open. A statement prepared before `close()` still answers queries afterwards. node:sqlite finalizes
every statement when the database closes, so the Node path never had the problem.

**Fix.** The adapter (`src/adapters/store/sqlite.ts`, copied from codebase-mcp) caches its
statements and finalizes every one before `db.close()`. The file is a raw client exempt from
coverage; the Windows **Tests** job in Self Test is where a regression shows, as test folders that
cannot be removed.

**Signal it is back.** A new statement cache, or `db.prepare`/`db.query` kept outside the
adapter's cache. Or `EBUSY` on `store.db` in the Windows CI job.
