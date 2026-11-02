/**
 * Turns what a person types into a safe SQLite FTS5 query. Words become quoted prefix terms (so
 * "pembayar" also finds "pembayaran"), "quoted phrases" stay phrases, and FTS5 operators typed by
 * accident can never break the query. `all` joins terms with AND, `any` with OR.
 */
const PHRASE = /"([^"]+)"/g;
const WORD = /[\p{L}\p{N}_]+/gu;

function quote(term: string): string {
  return `"${term.replace(/"/g, '""')}"`;
}

export function toFtsQuery(input: string, mode: 'all' | 'any'): string | null {
  const terms: string[] = [];
  for (const match of input.matchAll(PHRASE)) {
    const words = (match[1] ?? '').match(WORD) ?? [];
    if (words.length > 0) terms.push(quote(words.join(' ')));
  }
  for (const word of input.replace(PHRASE, ' ').match(WORD) ?? [])
    terms.push(word.length >= 3 ? `${quote(word)}*` : quote(word));
  if (terms.length === 0) return null;
  return terms.slice(0, 16).join(mode === 'all' ? ' ' : ' OR ');
}
