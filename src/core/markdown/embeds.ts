/**
 * Embedded or linked content that Markdown cannot carry: Figma designs, ClickUp whiteboards, other
 * docs and tasks, videos. read_doc lists them so the reader knows what to open or export by hand.
 */
type EmbedKind = 'figma' | 'whiteboard' | 'clickup-doc' | 'clickup-task' | 'video';

export interface Embed {
  readonly kind: EmbedKind;
  readonly url: string;
}

const URL_IN_TEXT = /https?:\/\/[^\s)<>"'\]]+/g;

function kindOf(url: URL): EmbedKind | null {
  const host = url.hostname;
  const path = url.pathname;
  if (host === 'figma.com' || host.endsWith('.figma.com')) return 'figma';
  if (/(^|\.)(youtube\.com|youtu\.be|loom\.com|vimeo\.com)$/.test(host)) return 'video';
  if (host !== 'clickup.com' && !host.endsWith('.clickup.com')) return null;
  if (/\/v\/wb\//.test(path)) return 'whiteboard';
  if (/\/v\/dc\/|\/d\/h\//.test(path)) return 'clickup-doc';
  if (path.startsWith('/t/')) return 'clickup-task';
  return null;
}

export function findEmbeds(markdown: string): Embed[] {
  const seen = new Set<string>();
  const embeds: Embed[] = [];
  for (const match of markdown.matchAll(URL_IN_TEXT)) {
    const text = match[0].replace(/[.,;:!?]+$/, '');
    if (seen.has(text)) continue;
    seen.add(text);
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      continue;
    }
    const kind = kindOf(url);
    if (kind) embeds.push({ kind, url: text });
  }
  return embeds;
}
