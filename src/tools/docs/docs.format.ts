/**
 * Text for `read_doc`: a header (where the content came from and how fresh it is), then an outline
 * or page content. Images become one line each with their img: reference and saved note, so the
 * model knows what is in a mockup without opening it; embeds that Markdown cannot carry are listed
 * at the end.
 */
import { findEmbeds } from '../../core/markdown/embeds.ts';
import { extractImages, replaceImages } from '../../core/markdown/images.ts';
import type { Page } from '../../core/model/clickup.types.ts';
import { ago, plural } from '../../core/output/text.ts';
import type { LoadedDoc } from '../../engine/docs/doc-loader.ts';

export type ImageInfo = ReadonlyMap<string, { ref: string; note: string | null }>;

export function formatHeader(loaded: LoadedDoc, creator: string, now: number): string {
  const { doc } = loaded;
  const source = loaded.tracked
    ? `tracked, synced ${loaded.syncedAt ? ago(loaded.syncedAt, now) : 'never'}`
    : 'live read (not tracked: track it to cache, search and diff it)';
  return [
    `Doc: ${doc.name} (doc:${doc.id}) · ${source}`,
    [
      creator ? `by ${creator}` : '',
      doc.dateUpdated ? `updated ${ago(doc.dateUpdated, now)}` : '',
      plural(loaded.pages.length, 'page'),
    ]
      .filter(Boolean)
      .join(' · '),
    ...(loaded.warning ? [`Note: ${loaded.warning}`] : []),
  ].join('\n');
}

export function formatOutline(loaded: LoadedDoc): string {
  const lines = loaded.pages.map((page) => {
    const images = extractImages(page.content).length;
    const size = `${page.content.length.toLocaleString('en-US')} chars${images > 0 ? `, ${plural(images, 'image')}` : ''}`;
    return `${'  '.repeat(page.depth + 1)}doc:${page.docId}/page:${page.id}  ${page.name} (${size})`;
  });
  return [
    'Pages:',
    ...lines,
    '',
    'Next: read_doc a page reference, or mode "full" for every page.',
  ].join('\n');
}

function imageLine(url: string, alt: string, info: ImageInfo): string {
  const known = info.get(url);
  const label = alt ? ` "${alt}"` : '';
  if (!known) return `[image${label}: not downloaded. view_image ${url}]`;
  return known.note
    ? `[image ${known.ref}${label}. Note: ${known.note}]`
    : `[image ${known.ref}${label}: no note yet. view_image ${known.ref}, then note_image]`;
}

export function renderPage(page: Page, info: ImageInfo): string {
  const body = replaceImages(page.content, (image) => imageLine(image.url, image.alt, info));
  return `## ${page.name} (doc:${page.docId}/page:${page.id})\n\n${body.trim() || '(empty page)'}`;
}

export function formatEmbeds(pages: readonly Page[]): string {
  const embeds = pages.flatMap((page) => findEmbeds(page.content));
  if (embeds.length === 0) return '';
  const unique = [...new Map(embeds.map((e) => [e.url, e])).values()];
  return [
    'Linked content not readable as text here:',
    ...unique.map((e) => `  ${e.kind}: ${e.url}`),
  ].join('\n');
}
