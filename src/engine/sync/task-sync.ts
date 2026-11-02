/**
 * Incremental task sync for a tracked list, folder or space: only tasks updated after the scope's
 * watermark, 100 per request, up to MAX_PAGES requests per run (the rest follows on the next run).
 * Comments are fetched for the tasks that changed, four at a time.
 */
import { mapLimit } from '../../core/async/map-limit.ts';
import type { Task } from '../../core/model/clickup.types.ts';
import type { TaskQuery } from '../../ports/clickup.ts';
import type { TaskEvent, Tracked } from '../../ports/store.ts';
import type { EngineDeps } from '../deps/engine-deps.types.ts';

const MAX_PAGES = 50;

export interface TaskSyncResult {
  readonly tasks: number;
  readonly events: readonly TaskEvent[];
  readonly watermark: number;
  /** True when MAX_PAGES was reached and more tasks wait for the next run. */
  readonly more: boolean;
}

function scopeFilter(tracked: Tracked): Pick<TaskQuery, 'listIds' | 'folderIds' | 'spaceIds'> {
  if (tracked.kind === 'list') return { listIds: [tracked.id] };
  if (tracked.kind === 'folder') return { folderIds: [tracked.id] };
  return { spaceIds: [tracked.id] };
}

async function fetchChanged(
  deps: EngineDeps,
  tracked: Tracked,
): Promise<{ tasks: Task[]; more: boolean }> {
  const base: Omit<TaskQuery, 'page'> = {
    ...scopeFilter(tracked),
    includeClosed: true,
    orderBy: 'updated',
    ...(tracked.watermark > 0 ? { updatedAfter: tracked.watermark } : {}),
  };
  const collect = async (page: number): Promise<{ tasks: Task[]; more: boolean }> => {
    const result = await deps.clickup.tasks({ ...base, page });
    if (result.lastPage) return { tasks: result.tasks, more: false };
    if (page + 1 >= MAX_PAGES) return { tasks: result.tasks, more: true };
    const rest = await collect(page + 1);
    return { tasks: [...result.tasks, ...rest.tasks], more: rest.more };
  };
  return collect(0);
}

export async function syncTasks(deps: EngineDeps, tracked: Tracked): Promise<TaskSyncResult> {
  const scope = `${tracked.kind}:${tracked.id}`;
  const { tasks, more } = await fetchChanged(deps, tracked);
  const events = deps.stores.tasks.save(tasks, {
    scope,
    at: deps.clock.now(),
    initial: tracked.syncedAt === null,
  });
  await mapLimit(tasks, 4, async (task) => {
    deps.stores.tasks.saveComments(task.id, await deps.clickup.comments(task.id));
  });
  const watermark = tasks.reduce((max, task) => Math.max(max, task.dateUpdated), tracked.watermark);
  return { tasks: tasks.length, events, watermark, more };
}
