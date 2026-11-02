/**
 * Tasks are read live: status and assignees change through the day and a stale copy misleads. The
 * cache is the fallback when ClickUp cannot be reached, and a short in-memory memo absorbs the
 * repeated reads of one conversation.
 */
import type { Comment, Task } from '../../core/model/clickup.types.ts';
import type { TaskQuery } from '../../ports/clickup.ts';
import { guard, isTransient } from '../api/guard.ts';
import type { EngineDeps } from '../deps/engine-deps.types.ts';

export interface LoadedTask {
  readonly task: Task;
  readonly warning: string | null;
}

const OFFLINE = 'ClickUp could not be reached; showing the copy from the last sync.';

export async function loadTask(deps: EngineDeps, id: string, custom: boolean): Promise<LoadedTask> {
  const memo = deps.memo.tasks.get(id);
  if (memo) return { task: memo, warning: null };
  try {
    const task = await deps.clickup.task(id, custom);
    deps.memo.tasks.set(id, task);
    return { task, warning: null };
  } catch (error) {
    const stored = isTransient(error) ? deps.stores.tasks.get(id) : null;
    if (stored) return { task: stored.task, warning: OFFLINE };
    return guard('task', () => Promise.reject(error));
  }
}

export async function loadComments(deps: EngineDeps, taskId: string): Promise<Comment[]> {
  try {
    return await deps.clickup.comments(taskId);
  } catch (error) {
    if (isTransient(error) && deps.stores.tasks.get(taskId))
      return deps.stores.tasks.comments(taskId);
    return guard('task comments', () => Promise.reject(error));
  }
}

export interface TaskPage {
  readonly tasks: readonly Task[];
  readonly lastPage: boolean;
}

export function listTasks(deps: EngineDeps, query: TaskQuery): Promise<TaskPage> {
  return guard('task list', () => deps.clickup.tasks(query));
}
