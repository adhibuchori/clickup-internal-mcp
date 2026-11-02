/**
 * Text for read_task and list_tasks. A task renders at three levels of detail (pickLevel): full,
 * then description and comments trimmed, then the essentials only, so a huge task still fits.
 */
import type { Comment, Task } from '../../core/model/clickup.types.ts';
import { ago, clip, formatDate, formatDateTime, plural } from '../../core/output/text.ts';

export interface TaskFormat {
  readonly now: number;
  readonly timeZone: string;
}

function ref(task: Pick<Task, 'id' | 'customId'>): string {
  return task.customId ? `task:${task.id} (${task.customId})` : `task:${task.id}`;
}

function dates(task: Task, f: TaskFormat): string {
  return [
    task.dueDate ? `Due ${formatDate(task.dueDate, f.timeZone)}` : '',
    task.startDate ? `Start ${formatDate(task.startDate, f.timeZone)}` : '',
    task.dateCreated ? `Created ${formatDate(task.dateCreated, f.timeZone)}` : '',
    task.dateUpdated ? `Updated ${ago(task.dateUpdated, f.now)}` : '',
    task.dateClosed ? `Closed ${formatDate(task.dateClosed, f.timeZone)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function header(task: Task, f: TaskFormat): string[] {
  const place = [
    `list:${task.listId} ${task.listName}`,
    task.folderName ? `folder ${task.folderName}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return [
    `${ref(task)} ${task.name}`,
    `Status: ${task.status || 'none'}${task.priority ? ` · Priority: ${task.priority}` : ''} · In ${place}`,
    `Assignees: ${task.assignees.join(', ') || 'none'}${task.creator ? ` · Creator: ${task.creator}` : ''}${task.tags.length > 0 ? ` · Tags: ${task.tags.join(', ')}` : ''}`,
    dates(task, f),
    ...(task.parentId ? [`Parent: task:${task.parentId}`] : []),
    `URL: ${task.url}`,
  ];
}

function details(task: Task): string[] {
  return [
    ...(task.customFields.length > 0
      ? [
          '',
          'Custom fields:',
          ...task.customFields.map((c) => `  ${c.name}: ${clip(c.value, 300)}`),
        ]
      : []),
    ...(task.subtasks.length > 0
      ? [
          '',
          `Subtasks (${task.subtasks.length}):`,
          ...task.subtasks.map((s) => `  task:${s.id} [${s.status}] ${s.name}`),
        ]
      : []),
    ...(task.attachments.length > 0
      ? [
          '',
          `Attachments (${task.attachments.length}):`,
          ...task.attachments.map((a) => `  ${a.title || 'file'} (${a.extension || '?'}) ${a.url}`),
        ]
      : []),
  ];
}

function commentLines(
  comments: readonly Comment[],
  f: TaskFormat,
  size: { max: number; width: number },
): string[] {
  const { max, width } = size;
  if (comments.length === 0) return [];
  const shown = comments.slice(-max);
  return [
    '',
    `Comments (${comments.length}${shown.length < comments.length ? `, last ${shown.length} shown` : ''}, oldest first):`,
    ...shown.map(
      (c) =>
        `  ${formatDateTime(c.date, f.timeZone)} ${c.author}${c.resolved ? ' (resolved)' : ''}: ${clip(c.text, width)}`,
    ),
  ];
}

function description(task: Task, max: number): string[] {
  const text = task.description.trim();
  if (!text) return ['', 'Description: (empty)'];
  const cut =
    text.length > max
      ? `${text.slice(0, max)}\n… (description cut; ${text.length.toLocaleString('en-US')} chars in all)`
      : text;
  return ['', 'Description:', cut];
}

/** The three renderings, most detailed first, for pickLevel. */
export function taskLevels(
  task: Task,
  comments: readonly Comment[] | null,
  f: TaskFormat,
): (() => string)[] {
  const all = comments ?? [];
  return [
    () =>
      [
        ...header(task, f),
        ...description(task, 100_000),
        ...details(task),
        ...commentLines(all, f, { max: 50, width: 2000 }),
      ].join('\n'),
    () =>
      [
        ...header(task, f),
        ...description(task, 4000),
        ...details(task),
        ...commentLines(all, f, { max: 10, width: 400 }),
      ].join('\n'),
    () =>
      [
        ...header(task, f),
        ...description(task, 800),
        `Subtasks: ${task.subtasks.length} · Comments: ${all.length}`,
      ].join('\n'),
  ];
}

function taskLine(task: Task, f: TaskFormat): string {
  return [
    `${ref(task)} [${task.status}] ${task.name}`,
    task.assignees.length > 0 ? task.assignees.map((a) => `@${a}`).join(' ') : '',
    task.dueDate ? `due ${formatDate(task.dueDate, f.timeZone)}` : '',
    `updated ${ago(task.dateUpdated, f.now)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function formatTaskList(
  result: { tasks: readonly Task[]; lastPage: boolean },
  page: number,
  f: TaskFormat,
): string {
  const { tasks, lastPage } = result;
  if (tasks.length === 0) return page === 0 ? 'No tasks match.' : 'No more tasks.';
  return [
    `${plural(tasks.length, 'task')} (page ${page}):`,
    ...tasks.map((t) => `  ${taskLine(t, f)}`),
    ...(lastPage ? [] : ['', `More tasks: same arguments with page ${page + 1}.`]),
  ].join('\n');
}
