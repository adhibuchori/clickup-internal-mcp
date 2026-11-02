/**
 * view_image and note_image. An image is found by its img: reference (a sha prefix) or by its URL;
 * a URL not seen before is downloaded from an allowed host. A note is saved once per image content
 * and reused until the image itself changes.
 */
import { ToolError } from '../../core/errors/tool-error.ts';
import { sniffImage } from '../../core/images/sniff.ts';
import type { Asset } from '../../ports/store.ts';
import type { EngineDeps } from '../deps/engine-deps.types.ts';
import { assetFileName, fetchImage } from './ingest.ts';

export interface ImageView {
  readonly asset: Asset;
  readonly note: string | null;
  /** Base64 bytes when the model can read the image inline, else null with a reason. */
  readonly data: string | null;
  readonly mime: string;
  readonly reason: string | null;
}

export async function findImage(
  deps: EngineDeps,
  input: { sha: string } | { url: string },
): Promise<Asset> {
  const asset =
    'sha' in input ? deps.stores.assets.byPrefix(input.sha) : await fetchImage(deps, input.url);
  if (asset) return asset;
  throw new ToolError(
    'sha' in input
      ? 'No image with that reference in the cache.'
      : 'That image could not be downloaded.',
    'sha' in input
      ? 'Use an img: reference from read_doc or read_task of a tracked doc.'
      : 'Only https images on ClickUp hosts (or CLICKUP_ASSET_HOSTS) can be fetched.',
  );
}

export function viewImage(deps: EngineDeps, asset: Asset): ImageView {
  const note = deps.stores.assets.note(asset.sha);
  const bytes = deps.assets.read(assetFileName(asset));
  const base = { asset, note, mime: asset.mime };
  if (!bytes)
    return {
      ...base,
      data: null,
      reason: 'The image file is missing from the cache; sync the doc again.',
    };
  const type = sniffImage(bytes);
  if (!type.viewable)
    return { ...base, data: null, reason: `It is ${type.mime}, which cannot be shown inline.` };
  if (bytes.byteLength > deps.config.maxViewBytes)
    return {
      ...base,
      data: null,
      reason: 'It is larger than the inline image limit; open it in ClickUp.',
    };
  return { ...base, mime: type.mime, data: Buffer.from(bytes).toString('base64'), reason: null };
}

export function noteImage(deps: EngineDeps, asset: Asset, note: string): void {
  deps.stores.assets.setNote(asset.sha, note.trim(), deps.clock.now());
}

/** Notes for the images of a page, keyed by source URL, for rendering read_doc. */
export function imageInfo(
  deps: EngineDeps,
  urls: readonly string[],
): Map<string, { ref: string; note: string | null }> {
  const info = new Map<string, { ref: string; note: string | null }>();
  for (const url of urls) {
    const asset = deps.stores.assets.bySource(url);
    if (asset)
      info.set(url, {
        ref: `img:${asset.sha.slice(0, 12)}`,
        note: deps.stores.assets.note(asset.sha),
      });
  }
  return info;
}
