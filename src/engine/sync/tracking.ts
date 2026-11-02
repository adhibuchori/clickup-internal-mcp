/**
 * What the user keeps on this laptop. Adding a scope syncs it at once; when the first sync takes
 * longer than `syncWaitMs` it finishes in the background and `track list` shows its progress.
 * Removing a scope deletes its docs, pages, revisions, tasks, comments, mirror files and any image
 * no other page still uses.
 */
import { mapLimit } from '../../core/async/map-limit.ts';
import { ToolError } from '../../core/errors/tool-error.ts';
import type { ScopeKind, Tracked } from '../../ports/store.ts';
import { guard } from '../api/guard.ts';
import { docFolder } from '../docs/mirror.ts';
import type { EngineDeps, ScopeSyncResult } from '../deps/engine-deps.types.ts';
import { assetFileName } from '../images/ingest.ts';
import { syncScope } from './scope-sync.ts';

export type Scope = { readonly kind: ScopeKind; readonly id: string };

function scopeKey(scope: Scope): string {
  return `${scope.kind}:${scope.id}`;
}

async function scopeName(deps: EngineDeps, scope: Scope): Promise<string> {
  switch (scope.kind) {
    case 'doc':
      return (await guard('doc', () => deps.clickup.doc(scope.id))).name;
    case 'list':
      return (await guard('list', () => deps.clickup.list(scope.id))).name;
    case 'folder':
      return (await guard('folder', () => deps.clickup.folder(scope.id))).name;
    default:
      return (await guard('space', () => deps.clickup.space(scope.id))).name;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 160) : 'unknown error';
}

/** Runs one sync of the scope, or joins the one already running. */
export function runSync(deps: EngineDeps, tracked: Tracked): Promise<ScopeSyncResult> {
  const key = scopeKey(tracked);
  const running = deps.running.get(key);
  if (running) return running;
  deps.stores.tracked.put({ ...tracked, status: 'syncing' });
  const work = (async () => {
    try {
      const { result, watermark } = await syncScope(deps, tracked);
      const status = result.more ? 'ok, more tasks on the next sync' : 'ok';
      deps.stores.tracked.put({ ...tracked, syncedAt: deps.clock.now(), watermark, status });
      return result;
    } catch (error) {
      deps.stores.tracked.put({ ...tracked, status: `error: ${message(error)}` });
      throw error;
    } finally {
      deps.running.delete(key);
    }
  })();
  deps.running.set(key, work);
  return work;
}

export type TrackOutcome =
  | { readonly state: 'done'; readonly tracked: Tracked; readonly result: ScopeSyncResult }
  | { readonly state: 'background'; readonly tracked: Tracked };

async function logFailure(deps: EngineDeps, scope: Scope, work: Promise<unknown>): Promise<void> {
  try {
    await work;
  } catch (error) {
    deps.logger.warn('background sync failed', { scope: scopeKey(scope), reason: message(error) });
  }
}

export async function track(deps: EngineDeps, scope: Scope): Promise<TrackOutcome> {
  const existing = deps.stores.tracked.get(scope.kind, scope.id);
  const tracked: Tracked = existing ?? {
    ...scope,
    name: await scopeName(deps, scope),
    addedAt: deps.clock.now(),
    syncedAt: null,
    watermark: 0,
    status: 'syncing',
  };
  const work = runSync(deps, tracked);
  const timeout = (async () => {
    await deps.wait(deps.config.syncWaitMs);
    return null;
  })();
  const result = await guard('scope', () => Promise.race([work, timeout]));
  if (result)
    return {
      state: 'done',
      tracked: deps.stores.tracked.get(scope.kind, scope.id) ?? tracked,
      result,
    };
  void logFailure(deps, scope, work);
  return { state: 'background', tracked };
}

/** Deletes files of images no page links to any more. */
function dropOrphanAssets(deps: EngineDeps): number {
  const orphans = deps.stores.assets.orphans();
  for (const asset of orphans) {
    deps.assets.remove(assetFileName(asset));
    deps.stores.assets.remove(asset.sha);
  }
  return orphans.length;
}

export function untrack(deps: EngineDeps, scope: Scope): Tracked {
  const tracked = deps.stores.tracked.get(scope.kind, scope.id);
  if (!tracked)
    throw new ToolError(
      `${scopeKey(scope)} is not tracked.`,
      'Call track with action "list" to see what is.',
    );
  const docIds = scope.kind === 'doc' ? [scope.id] : deps.stores.docs.idsOfScope(scopeKey(scope));
  for (const id of docIds) {
    const stored = deps.stores.docs.get(id);
    if (stored && deps.mirror) deps.mirror.removeDir(docFolder(stored.doc));
    deps.stores.docs.remove(id);
  }
  deps.stores.tasks.removeScope(scopeKey(scope));
  deps.stores.tracked.remove(scope.kind, scope.id);
  dropOrphanAssets(deps);
  return tracked;
}

/** Syncs every tracked scope not synced within `maxAgeMs`, two at a time. Failures are recorded on the scope. */
export async function syncStale(deps: EngineDeps, maxAgeMs: number): Promise<number> {
  const cutoff = deps.clock.now() - maxAgeMs;
  const stale = deps.stores.tracked.list().filter((t) => (t.syncedAt ?? 0) <= cutoff);
  await mapLimit(stale, 2, async (t) => {
    try {
      await runSync(deps, t);
    } catch (error) {
      deps.logger.warn('sync failed', { scope: scopeKey(t), reason: message(error) });
    }
  });
  return stale.length;
}

/** Retention at start-up: old revisions and events go, and so do image files nothing uses. */
export function prune(deps: EngineDeps): void {
  deps.stores.prune(deps.clock.now() - deps.config.ttlDays * 86_400_000);
  dropOrphanAssets(deps);
}
