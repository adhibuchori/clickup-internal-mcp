import { afterEach, beforeEach, expect, test } from 'bun:test';
import { openTestDb, task } from './store-helpers.ts';

let t: Awaited<ReturnType<typeof openTestDb>>;
beforeEach(async () => {
  t = await openTestDb();
});
afterEach(() => t.dispose());

test('saves tasks, finds them by id or custom id, and records events after the first sync', () => {
  expect(t.stores.tasks.save([task()], { scope: 'list:300', at: 10, initial: true })).toEqual([]);
  expect(t.stores.tasks.get('MOB-1')?.task.id).toBe('t1');
  expect(t.stores.tasks.get('t1')?.syncedAt).toBe(10);
  expect(t.stores.tasks.get('zzz')).toBeNull();
  const changed = task({
    status: 'review',
    assignees: ['bob'],
    priority: 'high',
    dueDate: 5,
    description: 'new',
    tags: [],
    name: 'Task v2',
    subtasks: [{ id: 's', name: 's', status: 'x' }],
  });
  const events = t.stores.tasks.save([changed, task({ id: 't2', customId: null })], {
    scope: 'list:300',
    at: 20,
    initial: false,
  });
  expect(events.map((e) => e.what)).toEqual([
    'status: open → review',
    'renamed from "Task"',
    'assignees +bob -alice',
    'priority: none → high',
    'due date changed',
    'description edited',
    'tags -a',
    'subtasks: 0 → 1',
    'created or moved here',
  ]);
  expect(t.stores.tasks.eventsSince(15)).toHaveLength(9);
  expect(t.stores.tasks.eventsSince(20)).toEqual([]);
});

test('comments are replaced whole, searchable, and removed with their scope', () => {
  t.stores.tasks.save([task()], { scope: 'list:300', at: 10, initial: true });
  const comment = {
    id: 'c1',
    taskId: 't1',
    author: 'bob',
    date: 3,
    text: 'disetujui risk',
    resolved: false,
    replies: 0,
  };
  t.stores.tasks.saveComments('t1', [comment, { ...comment, id: 'c0', date: 1, text: 'first' }]);
  expect(t.stores.tasks.comments('t1').map((c) => c.id)).toEqual(['c0', 'c1']);
  const hits = t.stores.search.search({
    match: '"disetujui"*',
    kinds: ['comment'],
    within: 'list:300',
    limit: 5,
    offset: 0,
  });
  expect(hits[0]).toMatchObject({
    ref: 'task:t1',
    title: 'Task (comment by bob)',
    kind: 'comment',
  });
  t.stores.tasks.saveComments('orphan', [{ ...comment, taskId: 'orphan' }]);
  t.stores.tasks.removeScope('list:300');
  expect(t.stores.tasks.get('t1')).toBeNull();
  expect(t.stores.tasks.comments('t1')).toEqual([]);
});
