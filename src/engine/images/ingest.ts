/**
 * Downloads the images of a page into the content-addressed asset store and links them to the
 * page. A URL already downloaded is never fetched again; a failure is logged and skipped, so one
 * broken image never fails a sync.
 */
import { createHash } from 'node:crypto';
import { mapLimit } from '../../core/async/map-limit.ts';
import { sniffImage } from '../../core/images/sniff.ts';
import { extractImages } from '../../core/markdown/images.ts';
import type { Page } from '../../core/model/clickup.types.ts';
import { isAllowedAssetUrl } from '../../core/security/hosts.ts';
import type { Asset } from '../../ports/store.ts';
import type { EngineDeps } from '../deps/engine-deps.types.ts';

export function assetFileName(asset: Pick<Asset, 'sha' | 'ext'>): string {
  return `${asset.sha}.${asset.ext}`;
}

/** The asset for an image URL: from the index, or downloaded now. Null when it cannot be fetched. */
export async function fetchImage(deps: EngineDeps, url: string): Promise<Asset | null> {
  const known = deps.stores.assets.bySource(url);
  if (known) return known;
  if (!isAllowedAssetUrl(url, deps.config.assetHosts)) return null;
  try {
    const { bytes } = await deps.clickup.download(url);
    const type = sniffImage(bytes);
    const sha = createHash('sha256').update(bytes).digest('hex');
    const asset: Asset = {
      sha,
      ext: type.ext,
      mime: type.mime,
      bytes: bytes.byteLength,
      sourceUrl: url,
    };
    deps.assets.write(assetFileName(asset), bytes);
    deps.stores.assets.put(asset, deps.clock.now());
    return asset;
  } catch (error) {
    deps.logger.warn('image skipped', {
      host: new URL(url).hostname,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

export interface IngestResult {
  readonly images: number;
  readonly failed: number;
}

export async function ingestPageImages(deps: EngineDeps, page: Page): Promise<IngestResult> {
  /* Two images at a time per page: pages are synced in parallel already. */
  const assets = await mapLimit(extractImages(page.content), 2, (image) =>
    fetchImage(deps, image.url),
  );
  const shas = assets.filter((asset) => asset !== null).map((asset) => asset.sha);
  deps.stores.assets.link(page.docId, page.id, shas);
  return { images: shas.length, failed: assets.length - shas.length };
}
