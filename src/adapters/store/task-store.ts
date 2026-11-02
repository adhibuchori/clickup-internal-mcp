/**
 * Tasks and comments of tracked lists, folders and spaces. Each save records what changed per task
 * (status, assignees, description...) as events, which is what `changes` reports for tasks.
 */
import type { Comment, Task } from '../../core/model/clickup.types.ts';
import type { TaskBatch, TaskEvent, TaskStore } from '../../ports/store.ts';
import { indexRow } from './fts-rows.ts';
import { commentSchema, taskSchema } from './json-schemas.ts';
import { int, parseJson, text, transaction } from './rows.ts';
import type { SqlDb } from './sqlite.ts';
import { describeTaskChange } from './task-events.ts';

function taskBody(task: Task): string {
  const fields = task.customFields.map((field) => `${field.name}: ${field.value}`);
  return [task.description, task.status, ...task.tags, ...fields].join('\n');
}

function readTask(db: SqlDb, id: string): { task: Task; syncedAt: number; scope: string } | null {
  const row = db.get('SELECT * FROM tasks WHERE id = ? OR custom_id = ? LIMIT 1', [id, id]);
  const task = row ? parseJson(taskSchema, text(row, 'json')) : null;
  return task ? { task, syncedAt: int(row, 'synced_at'), scope: text(row, 'scope') } : null;
}

function saveOne(db: SqlDb, task: Task, batch: TaskBatch): Task | null {
  const before = readTask(db, task.id)?.task ?? null;
  db.run(
    `INSERT INTO tasks (id, custom_id, scope, json, synced_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET custom_id = excluded.custom_id, scope = excluded.scope,
       json = excluded.json, synced_at = excluded.synced_at`,
    [task.id, task.customId, batch.scope, JSON.stringify(task), batch.at],
  );
  const title = task.customId ? `${task.customId} ${task.name}` : task.name;
  indexRow(db, {
    kind: 'task',
    ref: `task:${task.id}`,
    scope: batch.scope,
    title,
    body: taskBody(task),
  });
  return before;
}

function saveTasks(db: SqlDb, tasks: readonly Task[], batch: TaskBatch): TaskEvent[] {
  const events: TaskEvent[] = [];
  for (const task of tasks) {
    const before = saveOne(db, task, batch);
    const what = before
      ? describeTaskChange(before, task)
      : batch.initial
        ? []
        : ['created or moved here'];
    for (const line of what)
      events.push({ taskId: task.id, name: task.name, at: batch.at, what: line });
  }
  for (const e of events)
    db.run('INSERT INTO task_events (task_id, name, at, what) VALUES (?, ?, ?, ?)', [
      e.taskId,
      e.name,
      e.at,
      e.what,
    ]);
  return events;
}

function saveComments(db: SqlDb, taskId: string, comments: readonly Comment[]): void {
  const owner = readTask(db, taskId);
  db.run('DELETE FROM comments WHERE task_id = ?', [taskId]);
  db.run("DELETE FROM fts WHERE kind = 'comment' AND ref = ?", [`task:${taskId}`]);
  for (const comment of comments) {
    db.run('INSERT INTO comments (task_id, id, json) VALUES (?, ?, ?)', [
      taskId,
      comment.id,
      JSON.stringify(comment),
    ]);
    db.run('INSERT INTO fts (kind, ref, scope, title, body) VALUES (?, ?, ?, ?, ?)', [
      'comment',
      `task:${taskId}`,
      owner?.scope ?? '',
      `${owner?.task.name ?? taskId} (comment by ${comment.author})`,
      comment.text,
    ]);
  }
}

function removeScope(db: SqlDb, scope: string): void {
  transaction(db, () => {
    db.run('DELETE FROM comments WHERE task_id IN (SELECT id FROM tasks WHERE scope = ?)', [scope]);
    db.run("DELETE FROM fts WHERE kind IN ('task', 'comment') AND scope = ?", [scope]);
    db.run('DELETE FROM tasks WHERE scope = ?', [scope]);
  });
}

export function createTaskStore(db: SqlDb): TaskStore {
  return {
    get(id) {
      const found = readTask(db, id);
      return found ? { task: found.task, syncedAt: found.syncedAt } : null;
    },
    save: (tasks, batch) => transaction(db, () => saveTasks(db, tasks, batch)),
    saveComments: (taskId, comments) => transaction(db, () => saveComments(db, taskId, comments)),
    comments: (taskId) =>
      db
        .all('SELECT json FROM comments WHERE task_id = ?', [taskId])
        .map((row) => parseJson(commentSchema, text(row, 'json')))
        .filter((comment) => comment !== null)
        .toSorted((a, b) => a.date - b.date),
    removeScope: (scope) => removeScope(db, scope),
    eventsSince: (since) =>
      db
        .all('SELECT * FROM task_events WHERE at > ? ORDER BY at DESC, rowid DESC', [since])
        .map((row) => ({
          taskId: text(row, 'task_id'),
          name: text(row, 'name'),
          at: int(row, 'at'),
          what: text(row, 'what'),
        })),
  };
}
