/**
 * Decides what `read_doc` shows: the outline of a multi-page doc, one page, or every page, cut into
 * cursor-sized parts on paragraph breaks.
 */
import { ToolError } from '../../core/errors/tool-error.ts';
import { extractImages } from '../../core/markdown/images.ts';
import { pageText } from '../../core/markdown/paging.ts';
import type { Page } from '../../core/model/clickup.types.ts';
import { decodeCursor, encodeCursor, requestKey } from '../../core/output/cursor.ts';
import type { LoadedDoc } from '../../engine/docs/doc-loader.ts';
import type { EngineDeps } from '../../engine/deps/engine-deps.types.ts';
import { imageInfo } from '../../engine/images/images.ts';
import { formatEmbeds, formatOutline, renderPage } from './docs.format.ts';

type DocMode = 'auto' | 'outline' | 'full';

export function pickPage(pages: readonly Page[], wanted: string): Page {
  const needle = wanted.trim().toLowerCase();
  const page =
    pages.find((p) => p.id === wanted.trim()) ??
    pages.find((p) => p.name.toLowerCase() === needle) ??
    pages.find((p) => p.name.toLowerCase().includes(needle));
  if (page) return page;
  throw new ToolError(
    `No page "${wanted.slice(0, 60)}" in this doc.`,
    'Call read_doc with mode "outline" to list its pages.',
  );
}

interface BodyRequest {
  readonly loaded: LoadedDoc;
  readonly page: Page | null;
  readonly mode: DocMode;
  readonly cursor: string | undefined;
  readonly room: number;
}

function contentOf(deps: EngineDeps, pages: readonly Page[]): string {
  const info = imageInfo(
    deps,
    pages.flatMap((p) => extractImages(p.content).map((i) => i.url)),
  );
  const embeds = formatEmbeds(pages);
  return [...pages.map((p) => renderPage(p, info)), ...(embeds ? [embeds] : [])].join('\n\n');
}

export function docBody(deps: EngineDeps, request: BodyRequest): string {
  const { loaded, page, mode } = request;
  const single = loaded.pages.length === 1 ? loaded.pages : null;
  if (!page && mode !== 'full' && !(mode === 'auto' && single)) return formatOutline(loaded);
  const pages = page ? [page] : loaded.pages;
  const key = requestKey([loaded.doc.id, page?.id ?? '', mode]);
  const part = pageText(contentOf(deps, pages), decodeCursor(request.cursor, key), request.room);
  if (part.next === null) return part.text;
  return `${part.text}\n\n… more follows. Next: same arguments with cursor "${encodeCursor(part.next, key)}".`;
}
