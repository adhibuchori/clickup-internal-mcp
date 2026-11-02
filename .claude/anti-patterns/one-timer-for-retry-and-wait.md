---
paths:
  - 'src/engine/**'
  - 'src/composition/**'
---

# One Injected `sleep` for Both Retry Backoff and "Wait Up to N Seconds"

**Symptom.** In tests, `track add` answered "still running in the background" and the next read saw
no comments, although the fake API answers instantly.

**Cause.** The engine had one `sleep` dependency used for two jobs: the backoff between retries
(which tests make instant, so retries cost nothing) and the timer `track` races against a first sync
(which must really wait). With an instant sleep the race always lost, so every first sync went to
the background.

**Fix.** Two dependencies with two meanings: `deps.sleep` for backoff, `deps.wait` for the time
`track` is willing to wait. Tests keep `sleep` instant and `wait` real; the background path is
tested by making `wait` instant on purpose.

**Signal it is back.** A `Promise.race` against `deps.sleep(...)`, or a test that only passes with a
real delay in the retry path.
