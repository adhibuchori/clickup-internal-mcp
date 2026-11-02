/**
 * Syncs one doc into the cache: two API calls (the doc and all its pages with Markdown), then the
 * images of every page that changed, then the mirror. Unchanged pages cost nothing but a hash.
 */
import { mapLimit } from '../../core/async/map-limit.ts';
import type { PageChange } from '../../ports/store.ts';
import type { EngineDeps } from '../deps/engine-deps.types.ts';
import { ingestPageImages } from '../images/ingest.ts';
import { writeMirror } from './mirror.ts';

export interface DocSyncResult {
  readonly name: string;
  readonly pages: number;
  readonly changes: readonly PageChange[];
  readonly images: number;
  readonly failedImages: number;
}

export async function syncDoc(
  deps: EngineDeps,
  docId: string,
  scope: string,
): Promise<DocSyncResult> {
  const initial = deps.stores.docs.get(docId) === null;
  const [doc, pages] = await Promise.all([deps.clickup.doc(docId), deps.clickup.pages(docId)]);
  const changes = deps.stores.docs.save({ doc, scope, pages, at: deps.clock.now(), initial });
  const touched = initial
    ? pages.map((p) => p.id)
    : changes.filter((c) => c.kind !== 'removed').map((c) => c.pageId);
  const results = await mapLimit(
    pages.filter((page) => touched.includes(page.id)),
    4,
    (page) => ingestPageImages(deps, page),
  );
  writeMirror(deps, doc, pages);
  return {
    name: doc.name,
    pages: pages.length,
    changes,
    images: results.reduce((sum, r) => sum + r.images, 0),
    failedImages: results.reduce((sum, r) => sum + r.failed, 0),
  };
}
