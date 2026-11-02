---
paths:
  - 'src/**/__tests__/**'
---

# `await expect(promise).rejects…` Fails the `await-thenable` Lint

**Symptom.** oxlint (type-aware) reports `typescript(await-thenable): Unexpected await of a
non-Promise value` on every `await expect(p).rejects.toThrow(…)` in a test, although the tests pass.

**Cause.** bun-types declare the `rejects` matchers as returning `void`, so the type-aware rule sees
an `await` of a non-thenable. Dropping the `await` would make the assertion float and never fail the
test.

**Fix.** Catch the rejection and assert on the value:

```ts
expect(await http.getJson('/x').catch((error: unknown) => error)).toMatchObject({ status: 404 });
```

**Signal it is back.** `await-thenable` findings in test files only.
