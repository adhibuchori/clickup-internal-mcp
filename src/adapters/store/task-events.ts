/** What changed between two copies of a task, in words, for the `changes` tool. */
import type { Task } from '../../core/model/clickup.types.ts';

function listChange(label: string, before: readonly string[], after: readonly string[]): string[] {
  const added = after.filter((name) => !before.includes(name)).map((name) => `+${name}`);
  const removed = before.filter((name) => !after.includes(name)).map((name) => `-${name}`);
  const all = [...added, ...removed];
  return all.length > 0 ? [`${label} ${all.join(' ')}`] : [];
}

function valueChange(label: string, before: string | null, after: string | null): string[] {
  return before === after ? [] : [`${label}: ${before ?? 'none'} → ${after ?? 'none'}`];
}

export function describeTaskChange(before: Task, after: Task): string[] {
  return [
    ...valueChange('status', before.status, after.status),
    ...(before.name === after.name ? [] : [`renamed from "${before.name}"`]),
    ...listChange('assignees', before.assignees, after.assignees),
    ...valueChange('priority', before.priority, after.priority),
    ...(before.dueDate === after.dueDate ? [] : ['due date changed']),
    ...(before.description === after.description ? [] : ['description edited']),
    ...listChange('tags', before.tags, after.tags),
    ...(before.subtasks.length === after.subtasks.length
      ? []
      : [`subtasks: ${before.subtasks.length} → ${after.subtasks.length}`]),
  ];
}
