/**
 * Images inside ClickUp Markdown: `![alt](url "title")` and the `<img src="...">` ClickUp emits for
 * sized images. Extraction keeps first-seen order and drops repeats, so an image used twice is
 * downloaded and described once.
 */
export interface MarkdownImage {
  readonly url: string;
  readonly alt: string;
}

const MD_IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const HTML_IMAGE = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
const HTML_ALT = /\balt\s*=\s*["']([^"']*)["']/i;

export function extractImages(markdown: string): MarkdownImage[] {
  const found = new Map<string, string>();
  const add = (url: string | undefined, alt: string | undefined): void => {
    if (url && !found.has(url)) found.set(url, (alt ?? '').trim());
  };
  for (const match of markdown.matchAll(MD_IMAGE)) add(match[2], match[1]);
  for (const match of markdown.matchAll(HTML_IMAGE)) add(match[1], HTML_ALT.exec(match[0])?.[1]);
  return [...found].map(([url, alt]) => ({ url, alt }));
}

/** Replaces every image with what `render` returns for its URL and alt text. */
export function replaceImages(markdown: string, render: (image: MarkdownImage) => string): string {
  return markdown
    .replace(MD_IMAGE, (_all, alt: string, url: string) => render({ url, alt: alt.trim() }))
    .replace(HTML_IMAGE, (tag: string, url: string) =>
      render({ url, alt: (HTML_ALT.exec(tag)?.[1] ?? '').trim() }),
    );
}
