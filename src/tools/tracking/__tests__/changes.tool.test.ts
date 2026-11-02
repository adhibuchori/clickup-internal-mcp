import { afterEach, beforeEach, expect, test } from 'bun:test';
import { rawTask } from '../../../testing/fixtures/clickup-data.ts';
import { startTestRuntime, type TestRuntime } from '../../../testing/helpers/test-runtime.ts';

let t: TestRuntime;
beforeEach(async () => {
  t = await startTestRuntime();
});
afterEach(async () => {
  await t.close();
});

const page = (rt: TestRuntime) => rt.fake.data.pages['8cdu22c-13133']?.[0] ?? {};

test('nothing tracked, then nothing changed', async () => {
  expect((await t.call('changes')).text).toBe(
    'Nothing is tracked, so there are no changes to report.',
  );
  await t.call('track', { action: 'add', target: 'list:300' });
  expect((await t.call('changes')).text).toContain('No changes since');
});

test('page edits come with a diff; task events with what changed; the mark moves forward', async () => {
  await t.call('track', { action: 'add', target: 'list:300' });
  await t.call('changes');
  t.clock.advance(60 * 60_000);
  const subpages = page(t)['pages'];
  t.fake.data.pages['8cdu22c-13133'] = [
    { ...page(t), content: 'Checkout untuk pelanggan prioritas.', pages: subpages },
  ];
  t.fake.data.tasks[0] = rawTask({
    status: { status: 'review', type: 'custom' },
    date_updated: String(t.clock.now),
  });
  const { text } = await t.call('changes');
  expect(text).toContain('(synced 1 scope first)');
  expect(text).toContain(
    'doc:8cdu22c-13133/page:8cdu22c-4321  Checkout Requirements › Overview · changed just now (+1 −',
  );
  expect(text).toContain('    + Checkout untuk pelanggan prioritas.');
  expect(text).toContain(
    'task:86c1abcde  Checkout pesanan · status: in progress → review · just now',
  );
  expect((await t.call('changes', { sync: false })).text).toContain('No changes since');
  expect((await t.call('changes', { since: '2h', sync: false })).text).toContain(
    'status: in progress → review',
  );
});

test('added and removed pages; a small budget drops diffs and caps events', async () => {
  await t.call('track', { action: 'add', target: 'list:300' });
  t.clock.advance(60 * 60_000);
  t.fake.data.pages['8cdu22c-13133'] = [
    { id: 'new-1', name: 'Baru', content: 'Halaman baru', pages: [] },
  ];
  t.fake.data.tasks = Array.from({ length: 140 }, (_, i) =>
    rawTask({
      id: `x${String(i).padStart(7, '0')}`,
      custom_id: null,
      name: `T${i}`,
      date_updated: String(t.clock.now),
    }),
  );
  const small = await startTestRuntime({ fake: t.fake, runtime: { budget: 1200 } });
  small.runtime.deps.stores.meta.set('changes_seen_at', '0');
  await small.close();
  const { text } = await t.call('changes', { since: '30m' });
  expect(text).toContain('Baru · added');
  expect(text).toContain('Overview · removed');
  expect(text).toContain('created or moved here');
  const tiny = await startTestRuntime({ runtime: { budget: 1200 } });
  await tiny.call('track', { action: 'add', target: 'list:300' });
  tiny.clock.advance(60 * 60_000);
  tiny.fake.data.pages['8cdu22c-13133'] = [
    {
      ...page(tiny),
      content: Array.from({ length: 80 }, (_, i) => `baris ${i}`).join('\n'),
      pages: [],
    },
  ];
  tiny.fake.data.tasks = Array.from({ length: 140 }, (_, i) =>
    rawTask({
      id: `y${String(i).padStart(7, '0')}`,
      custom_id: null,
      name: `T${i}`,
      date_updated: String(tiny.clock.now),
    }),
  );
  const capped = await tiny.call('changes', { since: '30m' });
  expect(capped.text).toContain('more task events');
  expect(capped.text).not.toContain('    + baris');
  await tiny.close();
});

test('a long diff is cut with a pointer to read_doc', async () => {
  await t.call('track', { action: 'add', target: 'doc:8cdu22c-13133' });
  t.clock.advance(60 * 60_000);
  t.fake.data.pages['8cdu22c-13133'] = [
    { ...page(t), content: Array.from({ length: 60 }, (_, i) => `baris ${i}`).join('\n') },
  ];
  const { text } = await t.call('changes', { since: '30m' });
  expect(text).toContain('… (diff cut; read_doc the page for the rest)');
});

test('task events alone, and a doc that left a tracked list', async () => {
  await t.call('track', { action: 'add', target: 'list:300' });
  t.clock.advance(60 * 60_000);
  t.fake.data.tasks[0] = rawTask({
    priority: { priority: 'urgent' },
    date_updated: String(t.clock.now),
  });
  t.fake.data.docs = t.fake.data.docs.filter((doc) => doc['id'] !== '8cdu22c-13133');
  const { text } = await t.call('changes', { since: '30m' });
  expect(text).not.toContain('Docs:');
  expect(text).toContain('priority: high → urgent');
  expect(t.runtime.deps.stores.docs.get('8cdu22c-13133')).toBeNull();
});
