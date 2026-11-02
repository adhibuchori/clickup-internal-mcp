/** Text for `search`: numbered hits, each with its reference, title and a snippet. */
import type { SearchResult } from '../../engine/search/search.ts';

const LABEL = { page: 'doc page', task: 'task', comment: 'comment on' } as const;

export function formatHits(
  result: SearchResult,
  view: { query: string; limit: number; offset: number; next: string | null },
): string {
  if (result.tracked === 0)
    return 'Nothing is tracked yet, so there is nothing to search.\nHint: track a doc, list, folder or space first, e.g. {"action": "add", "target": "<a ClickUp URL>"}.';
  const hits = result.hits.slice(0, view.limit);
  if (hits.length === 0)
    return `No tracked content matches "${view.query}".\nHint: try fewer or different words, or browse and read live.`;
  const lines = hits.map((hit, i) => {
    const snippet = hit.snippet.replace(/\s+/g, ' ').trim();
    return `${view.offset + i + 1}. ${hit.ref} · ${LABEL[hit.kind]} · ${hit.title}${snippet ? `\n   ${snippet}` : ''}`;
  });
  return [
    ...(result.loosened ? ['No result has every word; showing results with any of them.'] : []),
    ...lines,
    ...(view.next ? ['', `More: same arguments with cursor "${view.next}".`] : []),
  ].join('\n');
}
