import { afterEach, beforeEach, expect, test } from 'bun:test';
import { startTestRuntime, type TestRuntime } from '../../../testing/helpers/test-runtime.ts';
import { memberNames } from '../members.ts';

let t: TestRuntime;
beforeEach(async () => {
  t = await startTestRuntime();
});
afterEach(async () => {
  await t.close();
});

test('names come from the cache; members are fetched at most once a day', async () => {
  expect(await memberNames(t.runtime.deps, [12, 0])).toEqual(new Map([[12, 'bob']]));
  await memberNames(t.runtime.deps, [99]);
  expect(t.fake.calls.filter((u) => u.endsWith('/api/v2/team'))).toHaveLength(1);
  t.clock.advance(25 * 3_600_000);
  await memberNames(t.runtime.deps, [99]);
  expect(t.fake.calls.filter((u) => u.endsWith('/api/v2/team'))).toHaveLength(2);
});

test('a failed member fetch is logged and the read goes on without names', async () => {
  t.fake.failures.push({ match: /\/team$/, status: 403, times: 1 });
  expect(await memberNames(t.runtime.deps, [12])).toEqual(new Map());
  expect(t.logs.some((l) => l.includes('member names unavailable'))).toBe(true);
});
