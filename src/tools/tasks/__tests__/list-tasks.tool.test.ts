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

const lastQuery = (rt: TestRuntime): URLSearchParams =>
  new URL(rt.fake.calls.findLast((u) => u.includes('/task?')) ?? 'https://x').searchParams;

test('lists the tasks of a list with one line each', async () => {
  const { text } = await t.call('list_tasks', { in: 'list:300' });
  expect(text).toContain('1 task (page 0):');
  expect(text).toContain(
    '  task:86c1abcde (MOB-1) [in progress] Checkout pesanan · @alice · due 2026-11-04 · updated 2h ago',
  );
  const q = lastQuery(t);
  expect(q.getAll('list_ids[]')).toEqual(['300']);
  expect(q.get('order_by')).toBe('updated');
  expect(q.get('include_markdown_description')).toBe('true');
});

test('folders and spaces, with every filter', async () => {
  await t.call('list_tasks', {
    in: 'folder:200',
    status: ['in progress'],
    tag: 'checkout',
    include_closed: true,
  });
  expect(lastQuery(t).getAll('project_ids[]')).toEqual(['200']);
  expect(lastQuery(t).getAll('statuses[]')).toEqual(['in progress']);
  expect(lastQuery(t).getAll('tags[]')).toEqual(['checkout']);
  const space = await t.call('list_tasks', {
    in: 'https://app.clickup.com/9001/v/s/100',
    updated_since: '7d',
    due_before: '2026-11-30',
  });
  expect(space.text).toContain('2 tasks');
  expect(lastQuery(t).get('date_updated_gt')).toBe(String(t.clock.now - 7 * 86_400_000));
  expect(lastQuery(t).get('due_date_lt')).toBe(String(Date.UTC(2026, 10, 29, 17)));
  expect(space.text).toContain('task:86c1fghij [to do] Backlog item · updated 1d ago');
});

test('assignee "me" resolves the user once; numbers pass through; anything else is refused', async () => {
  await t.call('list_tasks', { in: 'list:300', assignee: 'me' });
  await t.call('list_tasks', { in: 'list:300', assignee: 'ME' });
  expect(t.fake.calls.filter((u) => u.endsWith('/api/v2/user'))).toHaveLength(1);
  expect(lastQuery(t).getAll('assignees[]')).toEqual(['11']);
  await t.call('list_tasks', { in: 'list:300', assignee: '12' });
  expect(lastQuery(t).getAll('assignees[]')).toEqual(['12']);
  const bad = await t.call('list_tasks', { in: 'list:300', assignee: 'bob' });
  expect(bad.text).toContain('assignee must be "me" or a numeric ClickUp user id.');
});

test('pages of tasks, an empty result, and a bad time', async () => {
  t.fake.data.tasks.push(rawTask({ id: 'abc00001', custom_id: null }));
  t.fake.pageSize = 1;
  const first = await t.call('list_tasks', { in: 'list:300' });
  expect(first.text).toContain('More tasks: same arguments with page 1.');
  const second = await t.call('list_tasks', { in: 'list:300', page: 1 });
  expect(second.text).not.toContain('More tasks');
  expect((await t.call('list_tasks', { in: 'list:300', page: 5 })).text).toBe('No more tasks.');
  expect((await t.call('list_tasks', { in: 'list:999' })).text).toBe('No tasks match.');
  expect((await t.call('list_tasks', { in: 'list:300', updated_since: 'kemarin' })).isError).toBe(
    true,
  );
});
