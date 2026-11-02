/**
 * Reads a doc the fastest way that is still correct. A tracked doc comes from the cache, re-synced
 * first when it is older than `staleMs` or when the caller asks for fresh content; if that re-sync
 * fails for a transient reason, the cached copy is served with a note. An untracked doc is read live
 * and kept only in memory for a few minutes.
 */
import type { DocSummary, Page } from '../../core/model/clickup.types.ts';
import { guard, isTransient } from '../api/guard.ts';
import type { EngineDeps } from '../deps/engine-deps.types.ts';
import { syncDoc } from './doc-sync.ts';

export interface LoadedDoc {
  readonly doc: DocSummary;
  readonly pages: readonly Page[];
  readonly tracked: boolean;
  /** When the content was fetched from ClickUp, or null for a live read. */
  readonly syncedAt: number | null;
  /** Set when a cached copy is served because ClickUp could not be reached. */
  readonly warning: string | null;
}

async function fromCache(
  deps: EngineDeps,
  docId: string,
  fresh: boolean,
): Promise<LoadedDoc | null> {
  const stored = deps.stores.docs.get(docId);
  if (!stored) return null;
  let warning: string | null = null;
  if (fresh || stored.syncedAt < deps.clock.now() - deps.config.staleMs) {
    try {
      await syncDoc(deps, docId, stored.scope);
    } catch (error) {
      if (!isTransient(error)) return guard('doc', () => Promise.reject(error));
      warning = 'ClickUp could not be reached; showing the copy from the last sync.';
    }
  }
  const latest = deps.stores.docs.get(docId) ?? stored;
  return {
    doc: latest.doc,
    pages: deps.stores.docs.pages(docId),
    tracked: true,
    syncedAt: latest.syncedAt,
    warning,
  };
}

export async function loadDoc(deps: EngineDeps, docId: string, fresh: boolean): Promise<LoadedDoc> {
  const cached = await fromCache(deps, docId, fresh);
  if (cached) return cached;
  const memo = fresh ? undefined : deps.memo.docs.get(docId);
  const live =
    memo ??
    (await guard('doc', async () => {
      const [doc, pages] = await Promise.all([deps.clickup.doc(docId), deps.clickup.pages(docId)]);
      return { doc, pages };
    }));
  deps.memo.docs.set(docId, live);
  return { ...live, tracked: false, syncedAt: null, warning: null };
}
