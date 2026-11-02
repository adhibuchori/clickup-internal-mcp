import { afterEach, beforeEach, expect, test } from 'bun:test';
import { startTestRuntime, type TestRuntime } from '../../../testing/helpers/test-runtime.ts';
import { runDoctor } from '../doctor.ts';

let t: TestRuntime;
beforeEach(async () => {
  t = await startTestRuntime();
});
afterEach(async () => {
  await t.close();
});

const info = { tokenTail: 'abcd', dataDir: '/data', mirrorDir: null };

test('a working setup passes every check without showing the token', async () => {
  const checks = await runDoctor(t.runtime.deps, info);
  expect(checks.every((c) => c.ok)).toBe(true);
  expect(checks[0]?.detail).toBe('accepted for alice (token …abcd)');
  expect(checks[1]?.detail).toBe('workspace 9001 reachable, 1 spaces visible');
  expect(checks[3]?.detail).toContain('off');
  expect((await runDoctor(t.runtime.deps, { ...info, mirrorDir: '/m' }))[3]?.detail).toBe('/m');
});

test('a rejected token fails and skips the workspace check; a wrong workspace fails alone', async () => {
  t.fake.failures.push({ match: /\/user$/, status: 401, times: 1 });
  const bad = await runDoctor(t.runtime.deps, info);
  expect(bad[0]).toMatchObject({ ok: false });
  expect(bad[0]?.detail).toContain('Settings → Apps');
  expect(bad[1]?.detail).toBe('skipped: the token check failed');
  t.fake.failures.push({ match: /\/space\?/, status: 404, times: 4, body: 'not json' });
  const space = await runDoctor(t.runtime.deps, info);
  expect(space[1]).toMatchObject({ ok: false });
  expect(space[1]?.detail).toContain('CLICKUP_WORKSPACE_ID');
});
