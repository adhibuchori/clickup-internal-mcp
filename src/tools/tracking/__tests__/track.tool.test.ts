import { afterEach, beforeEach, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IMAGE_URL } from '../../../testing/fixtures/clickup-data.ts';
import { startTestRuntime, type TestRuntime } from '../../../testing/helpers/test-runtime.ts';

let t: TestRuntime;
beforeEach(async () => {
  t = await startTestRuntime();
});
afterEach(async () => {
  await t.close();
});

test('add a doc: pages and images are cached; list shows it and the images waiting for a note', async () => {
  const added = await t.call('track', {
    action: 'add',
    target: 'https://app.clickup.com/9001/v/dc/8cdu22c-13133/8cdu22c-4321',
  });
  expect(added.text).toContain(
    'Tracking doc:8cdu22c-13133  Checkout Requirements · synced just now · ok',
  );
  expect(added.text).toContain('Synced: 1 doc, 0 page changes, 0 tasks updated, 1 image.');
  const list = await t.call('track', { action: 'list' });
  expect(list.text).toContain('Tracked (1):');
  expect(list.text).toContain('1 image in tracked docs have no note yet');
  expect(readdirSync(join(t.dir, 'data', 'assets'))).toHaveLength(1);
});

test('add a list, a folder and a space: tasks, comments and the docs under them', async () => {
  const list = await t.call('track', { action: 'add', target: 'list:300' });
  expect(list.text).toContain('Synced: 1 doc, 0 page changes, 1 task updated, 1 image.');
  const folder = await t.call('track', { action: 'add', target: 'folder:200' });
  expect(folder.text).toContain('2 docs');
  const space = await t.call('track', { action: 'add', target: 'space:100' });
  expect(space.text).toContain('3 docs');
  expect(space.text).toContain('2 tasks updated');
  const again = await t.call('track', { action: 'add', target: 'space:100' });
  expect(again.text).toContain('0 tasks updated');
});

test('sync one scope or all; a missing target or an untracked scope is explained', async () => {
  await t.call('track', { action: 'add', target: 'doc:8cdu22c-200' });
  expect((await t.call('track', { action: 'sync', target: 'doc:8cdu22c-200' })).text).toContain(
    'Synced: 1 doc',
  );
  expect((await t.call('track', { action: 'sync' })).text).toContain('Synced 1 scopes.');
  expect((await t.call('track', { action: 'sync', target: 'list:300' })).text).toContain(
    'is not tracked',
  );
  expect((await t.call('track', { action: 'add' })).text).toContain('This action needs a target.');
  expect((await t.call('track', { action: 'remove', target: 'list:300' })).text).toContain(
    'list:300 is not tracked.',
  );
  expect((await t.call('track', { action: 'list' })).text).toContain(
    'doc:8cdu22c-200  Space Handbook',
  );
});

test('remove deletes the cached content, the mirror folder and unused images', async () => {
  const mirrored = await startTestRuntime({ settings: { mirrorDir: join(t.dir, 'mirror') } });
  await mirrored.call('track', { action: 'add', target: 'list:300' });
  const folder = join(t.dir, 'mirror', 'checkout-requirements-8cdu22c-13133');
  expect(readdirSync(folder).toSorted()).toEqual(['01-overview.md', '02-limits.md', 'assets']);
  const overview = readFileSync(join(folder, '01-overview.md'), 'utf8');
  expect(overview).toContain('ref: doc:8cdu22c-13133/page:8cdu22c-4321');
  expect(overview).toMatch(/!\[mockup layar checkout\]\(assets\/[0-9a-f]{12}\.png\)/);
  const removed = await mirrored.call('track', { action: 'remove', target: 'list:300' });
  expect(removed.text).toContain(
    'Stopped tracking list:300 Sprint 42 and deleted its cached content.',
  );
  expect(existsSync(folder)).toBe(false);
  expect(readdirSync(join(mirrored.dir, 'data', 'assets'))).toEqual([]);
  expect((await mirrored.call('track', { action: 'list' })).text).toContain('Nothing is tracked.');
  expect(
    (await mirrored.call('read_task', { task: 'task:86c1abcde', comments: false })).isError,
  ).toBe(false);
  await mirrored.close();
});

test('a doc whose image cannot be downloaded still syncs, and the mirror keeps the remote link', async () => {
  const mirrored = await startTestRuntime({ settings: { mirrorDir: join(t.dir, 'mirror') } });
  delete mirrored.fake.data.images[IMAGE_URL];
  const added = await mirrored.call('track', { action: 'add', target: 'doc:8cdu22c-13133' });
  expect(added.text).toContain('(1 could not be downloaded)');
  const overview = readFileSync(
    join(t.dir, 'mirror', 'checkout-requirements-8cdu22c-13133', '01-overview.md'),
    'utf8',
  );
  expect(overview).toContain(`](${IMAGE_URL})`);
  expect(mirrored.logs.some((l) => l.includes('image skipped'))).toBe(true);
  await mirrored.close();
});

test('a slow first sync finishes in the background and records failures on the scope', async () => {
  const slow = await startTestRuntime({ runtime: { wait: async () => {} } });
  const added = await slow.call('track', { action: 'add', target: 'doc:8cdu22c-200' });
  expect(added.text).toContain('still running in the background');
  await Promise.all(slow.runtime.deps.running.values());
  expect((await slow.call('track', { action: 'list' })).text).toContain('· ok');
  slow.fake.failures.push({ match: /8cdu22c-300\/pages/, status: 500, times: 20 });
  await slow.call('track', { action: 'add', target: 'doc:8cdu22c-300' });
  await Promise.allSettled(slow.runtime.deps.running.values());
  expect((await slow.call('track', { action: 'list' })).text).toContain('error: Injected failure');
  expect(slow.logs.some((l) => l.includes('background sync failed'))).toBe(true);
  await slow.call('track', { action: 'sync' });
  expect(slow.logs.some((l) => l.includes('sync failed'))).toBe(true);
  await slow.close();
});

test('a scope that fails on its first sync reports the reason', async () => {
  t.fake.failures.push({ match: /\/pages/, status: 403, times: 5 });
  const added = await t.call('track', { action: 'add', target: 'doc:8cdu22c-200' });
  expect(added.isError).toBe(true);
  expect(added.text).toContain('Your ClickUp account cannot open this scope.');
  expect((await t.call('track', { action: 'add', target: 'doc:8cdu22c-404' })).text).toContain(
    'No doc with that id',
  );
});

test('two syncs of one scope at once share the work', async () => {
  await t.call('track', { action: 'add', target: 'doc:8cdu22c-200' });
  const before = t.fake.calls.length;
  await Promise.all([
    t.call('track', { action: 'sync', target: 'doc:8cdu22c-200' }),
    t.call('track', { action: 'sync', target: 'doc:8cdu22c-200' }),
  ]);
  expect(t.fake.calls.length - before).toBe(2);
});
