/**
 * Syncs one tracked scope. A doc syncs alone. A list, folder or space syncs its tasks and the docs
 * directly under it (and, for a folder or space, under its lists and folders), four docs at a time.
 * Docs that were under the scope before and are gone now are dropped from the cache.
 */
import { mapLimit } from '../../core/async/map-limit.ts';
import type { DocSummary } from '../../core/model/clickup.types.ts';
import type { Tracked } from '../../ports/store.ts';
import { docsUnder } from '../browse/hierarchy.ts';
import { type DocSyncResult, syncDoc } from '../docs/doc-sync.ts';
import type { EngineDeps, ScopeSyncResult } from '../deps/engine-deps.types.ts';
import { syncTasks, type TaskSyncResult } from './task-sync.ts';

async function scopeDocs(deps: EngineDeps, tracked: Tracked): Promise<DocSummary[]> {
  if (tracked.kind === 'doc' || tracked.kind === 'list')
    return tracked.kind === 'doc' ? [] : docsUnder(deps, { kind: 'list', id: tracked.id });
  const own = docsUnder(deps, { kind: tracked.kind, id: tracked.id });
  if (tracked.kind === 'folder') {
    const folder = await deps.clickup.folder(tracked.id);
    const nested = await mapLimit(folder.lists, 4, (list) =>
      docsUnder(deps, { kind: 'list', id: list.id }),
    );
    return [...(await own), ...nested.flat()];
  }
  const [folders, lists] = await Promise.all([
    deps.clickup.folders(tracked.id),
    deps.clickup.folderlessLists(tracked.id),
  ]);
  const containers = [
    ...folders.map((f) => ({ kind: 'folder' as const, id: f.id })),
    ...[...lists, ...folders.flatMap((f) => f.lists)].map((l) => ({
      kind: 'list' as const,
      id: l.id,
    })),
  ];
  const nested = await mapLimit(containers, 4, (c) => docsUnder(deps, c));
  return [...(await own), ...nested.flat()];
}

function summarize(docs: readonly DocSyncResult[], tasks: TaskSyncResult | null): ScopeSyncResult {
  const sum = (pick: (d: DocSyncResult) => number): number => docs.reduce((n, d) => n + pick(d), 0);
  return {
    docs: docs.length,
    pageChanges: sum((d) => d.changes.length),
    tasks: tasks?.tasks ?? 0,
    taskEvents: tasks?.events.length ?? 0,
    images: sum((d) => d.images),
    failedImages: sum((d) => d.failedImages),
    more: tasks?.more ?? false,
  };
}

export async function syncScope(
  deps: EngineDeps,
  tracked: Tracked,
): Promise<{ result: ScopeSyncResult; watermark: number }> {
  const scope = `${tracked.kind}:${tracked.id}`;
  const isDoc = tracked.kind === 'doc';
  const docIds = isDoc
    ? [tracked.id]
    : [...new Set((await scopeDocs(deps, tracked)).map((d) => d.id))];
  const tasks = isDoc ? null : await syncTasks(deps, tracked);
  const docs = await mapLimit(docIds, 4, (id) => syncDoc(deps, id, scope));
  for (const gone of deps.stores.docs.idsOfScope(scope).filter((id) => !docIds.includes(id)))
    deps.stores.docs.remove(gone);
  return { result: summarize(docs, tasks), watermark: tasks?.watermark ?? tracked.watermark };
}
