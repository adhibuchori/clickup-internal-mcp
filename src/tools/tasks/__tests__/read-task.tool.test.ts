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

test('renders every part of a task, dates in the user time zone', async () => {
  const { text, isError } = await t.call('read_task', {
    task: 'https://app.clickup.com/t/86c1abcde',
  });
  expect(isError).toBe(false);
  for (const line of [
    'task:86c1abcde (MOB-1) Checkout pesanan',
    'Status: in progress · Priority: high · In list:300 Sprint 42, folder Mobile App',
    'Assignees: alice · Creator: bob · Tags: checkout',
    'Due 2026-11-04 · Created 2026-10-23 · Updated 2h ago',
    '## Acceptance',
    '  Channel: Mobile',
    '  Areas: Orders',
    '  Go live: 2026-11-05',
    '  Reviewed: yes',
    '  Owner: bob',
    '  Note: ok',
    'Subtasks (1):\n  task:86c1sub01 [to do] API contract',
    'Attachments (1):\n  spec.pdf (pdf) https://t9001.p.clickup-attachments.com/spec.pdf',
    'Comments (2, oldest first):',
    'bob: Batas sudah disetujui tim produk.',
    'alice (resolved): Siap, lanjut.',
  ])
    expect(text).toContain(line);
  expect(text).not.toContain('Empty:');
});

test('custom ids are looked up with the workspace id; comments can be left out', async () => {
  const { text } = await t.call('read_task', { task: 'task:MOB-1', comments: false });
  expect(text).not.toContain('Comments');
  expect(
    t.fake.calls.some(
      (url) =>
        url.includes('/task/MOB-1?') &&
        url.includes('custom_task_ids=true') &&
        url.includes('team_id=9001'),
    ),
  ).toBe(true);
});

test('a task with little in it, and a parent task', async () => {
  t.fake.data.tasks.push(
    rawTask({
      id: 'abc12345',
      custom_id: null,
      parent: '86c1abcde',
      markdown_description: '',
      text_content: null,
      assignees: [],
      tags: [],
      priority: null,
      custom_fields: [],
      subtasks: [],
      attachments: [],
      start_date: '1',
      date_closed: String(Date.UTC(2026, 10, 1)),
      status: undefined,
      list: undefined,
      folder: undefined,
      space: undefined,
      creator: undefined,
      date_updated: null,
      date_created: null,
    }),
  );
  const { text } = await t.call('read_task', { task: 'task:abc12345' });
  expect(text).toContain('Status: none · In list: ');
  expect(text).toContain('Assignees: none');
  expect(text).toContain('Parent: task:86c1abcde');
  expect(text).toContain('Description: (empty)');
  expect(text).toContain('Closed 2026-11-01');
});

test('a huge task steps down in detail to fit the budget', async () => {
  t.fake.data.tasks[0] = rawTask({ markdown_description: 'Panjang. '.repeat(3000) });
  const small = await startTestRuntime({ fake: t.fake, runtime: { budget: 3000 } });
  const { text } = await small.call('read_task', { task: 'task:86c1abcde' });
  expect(text).toContain('(description cut;');
  expect(text).toContain('Subtasks: 1 · Comments: 2');
  await small.close();
  const medium = await startTestRuntime({ fake: t.fake, runtime: { budget: 9000 } });
  expect((await medium.call('read_task', { task: 'task:86c1abcde' })).text).toContain(
    'Custom fields:',
  );
  await medium.close();
});

test('repeated reads within a minute use the memo', async () => {
  await t.call('read_task', { task: 'task:86c1abcde', comments: false });
  const calls = t.fake.calls.length;
  await t.call('read_task', { task: 'task:86c1abcde', comments: false });
  expect(t.fake.calls.length).toBe(calls);
});

test('when ClickUp is unreachable a tracked copy is shown, otherwise the error explains', async () => {
  await t.call('track', { action: 'add', target: 'list:300' });
  t.fake.failures.push({ match: /\/task\/86c1abcde/, status: 502, times: 20 });
  const offline = await t.call('read_task', { task: 'task:86c1abcde' });
  expect(offline.text).toContain(
    'Note: ClickUp could not be reached; showing the copy from the last sync.',
  );
  expect(offline.text).toContain('Batas sudah disetujui tim produk.');
  const untracked = await t.call('read_task', { task: 'task:zzzzzz1' });
  expect(untracked.text).toContain('No task with that id');
  t.fake.failures.push({ match: /\/task\/86c1fghij/, status: 502, times: 20 });
  const noCopy = await t.call('read_task', { task: 'task:86c1fghij', comments: false });
  expect(noCopy.text).toContain('ClickUp could not return the task (502 FAKE_001)');
});

test('comment failures: cached when tracked and transient, explained otherwise', async () => {
  await t.call('track', { action: 'add', target: 'list:300' });
  t.fake.failures.push({ match: /86c1abcde\/comment/, status: 500, times: 20 });
  expect((await t.call('read_task', { task: 'task:86c1abcde' })).text).toContain('Siap, lanjut.');
  t.fake.failures.length = 0;
  t.fake.failures.push({ match: /86c1fghij\/comment/, status: 403, times: 1 });
  const denied = await t.call('read_task', { task: 'task:86c1fghij' });
  expect(denied.text).toContain('Your ClickUp account cannot open this task comments.');
});

test('a rejected token says what to do', async () => {
  t.fake.failures.push({ match: /./, status: 401, times: 1 });
  const { text, isError } = await t.call('read_task', { task: 'task:86c1abcde' });
  expect(isError).toBe(true);
  expect(text).toContain('ClickUp rejected the token.');
  expect(text).toContain('bun run doctor');
});

test('a custom field holding an unknown object is shown as compact JSON', async () => {
  t.fake.data.tasks[0] = rawTask({
    custom_fields: [{ name: 'Blob', type: 'unknown', value: { a: 1 } }],
  });
  expect((await t.call('read_task', { task: 'task:86c1abcde', comments: false })).text).toContain(
    '  Blob: {"a":1}',
  );
});
