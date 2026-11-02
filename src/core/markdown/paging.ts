/**
 * Long Markdown in pages that end on a paragraph or line break, so a cursor never splits a sentence
 * or a table row. Offsets are character positions in the full text.
 */
export interface TextPage {
  readonly text: string;
  /** Where the next page starts, or null at the end. */
  readonly next: number | null;
}

export function pageText(text: string, offset: number, maxChars: number): TextPage {
  const start = Math.min(Math.max(0, offset), text.length);
  if (text.length - start <= maxChars) return { text: text.slice(start), next: null };
  const limit = start + maxChars;
  const paragraph = text.lastIndexOf('\n\n', limit);
  const line = text.lastIndexOf('\n', limit);
  const half = start + maxChars / 2;
  const end = paragraph > half ? paragraph + 2 : line > half ? line + 1 : limit;
  return { text: text.slice(start, end).trimEnd(), next: end };
}
