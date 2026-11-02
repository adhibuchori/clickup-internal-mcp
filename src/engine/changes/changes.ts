/**
 * What moved in tracked content since a point in time: page edits (with their diff), pages added or
 * removed, and task events. "Since the last look" is a timestamp kept in the cache and advanced each
 * time the caller asks without a date. Stale scopes are synced first so the answer is current.
 */
import type { PageChange, TaskEvent } from '../../ports/store.ts';
import type { EngineDeps } from '../deps/engine-deps.types.ts';
import { syncStale } from '../sync/tracking.ts';

const LAST_LOOK = 'changes_seen_at';
const FRESH_ENOUGH = 10 * 60_000;

export interface ChangeReport {
  readonly since: number;
  readonly pages: readonly PageChange[];
  readonly tasks: readonly TaskEvent[];
  readonly synced: number;
  readonly tracked: number;
}

export async function collectChanges(
  deps: EngineDeps,
  options: { since: number | null; sync: boolean },
): Promise<ChangeReport> {
  const synced = options.sync ? await syncStale(deps, FRESH_ENOUGH) : 0;
  const lastLook = Number(deps.stores.meta.get(LAST_LOOK) ?? '0');
  const since = options.since ?? lastLook;
  const report = {
    since,
    pages: deps.stores.docs.changesSince(since),
    tasks: deps.stores.tasks.eventsSince(since),
    synced,
    tracked: deps.stores.tracked.list().length,
  };
  if (options.since === null) deps.stores.meta.set(LAST_LOOK, String(deps.clock.now()));
  return report;
}
