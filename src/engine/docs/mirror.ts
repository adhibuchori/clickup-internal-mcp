/**
 * Writes a tracked doc to the Markdown mirror: one file per page with front matter (source URL,
 * ids, update time) and its images copied beside it, links rewritten to the local copies. The doc
 * folder is rewritten whole on every sync, so removed pages disappear from the mirror too.
 */
import { replaceImages } from '../../core/markdown/images.ts';
import type { DocSummary, Page } from '../../core/model/clickup.types.ts';
import { slug } from '../../core/paths/slug.ts';
import type { MirrorFiles } from '../../ports/files.ts';
import type { EngineDeps } from '../deps/engine-deps.types.ts';
import { assetFileName } from '../images/ingest.ts';

export function docFolder(doc: Pick<DocSummary, 'id' | 'name'>): string {
  return `${slug(doc.name)}-${doc.id}`;
}

function frontMatter(deps: EngineDeps, doc: DocSummary, page: Page): string {
  const url = `https://app.clickup.com/${deps.config.workspaceId}/v/dc/${doc.id}/${page.id}`;
  return [
    '---',
    `doc: ${JSON.stringify(doc.name)}`,
    `page: ${JSON.stringify(page.name)}`,
    `ref: doc:${doc.id}/page:${page.id}`,
    `url: ${url}`,
    `updated: ${page.dateUpdated ? new Date(page.dateUpdated).toISOString() : 'unknown'}`,
    '---',
    '',
  ].join('\n');
}

function localImages(
  deps: EngineDeps,
  target: { mirror: MirrorFiles; folder: string },
  content: string,
): string {
  const { mirror, folder } = target;
  return replaceImages(content, (image) => {
    const asset = deps.stores.assets.bySource(image.url);
    const bytes = asset ? deps.assets.read(assetFileName(asset)) : null;
    if (!asset || !bytes) return `![${image.alt}](${image.url})`;
    const name = `${asset.sha.slice(0, 12)}.${asset.ext}`;
    mirror.write(`${folder}/assets/${name}`, bytes);
    return `![${image.alt}](assets/${name})`;
  });
}

export function writeMirror(deps: EngineDeps, doc: DocSummary, pages: readonly Page[]): void {
  const mirror = deps.mirror;
  if (!mirror) return;
  const folder = docFolder(doc);
  mirror.removeDir(folder);
  const width = Math.max(2, String(pages.length).length);
  for (const page of pages) {
    const name = `${String(page.position + 1).padStart(width, '0')}-${slug(page.name)}.md`;
    const body = localImages(deps, { mirror, folder }, page.content);
    mirror.write(`${folder}/${name}`, `${frontMatter(deps, doc, page)}# ${page.name}\n\n${body}\n`);
  }
}
