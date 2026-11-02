/**
 * Full-text search over everything tracked, ranked by BM25 with titles weighted above bodies. The
 * MATCH expression comes from core/search/fts-query.ts, so user input never reaches FTS5 raw.
 */
import type { HitKind, SearchHit, SearchIndex, SearchQuery } from '../../ports/store.ts';
import { text } from './rows.ts';
import type { SqlDb, SqlRow } from './sqlite.ts';

const KINDS: readonly HitKind[] = ['page', 'task', 'comment'];

function toHit(row: SqlRow): SearchHit {
  return {
    kind: KINDS.find((kind) => kind === text(row, 'kind')) ?? 'page',
    ref: text(row, 'ref'),
    title: text(row, 'title'),
    snippet: text(row, 'snippet'),
    scope: text(row, 'scope'),
  };
}

export function createSearchIndex(db: SqlDb): SearchIndex {
  return {
    search(query: SearchQuery) {
      const kinds = query.kinds.length > 0 ? query.kinds : KINDS;
      const marks = kinds.map(() => '?').join(', ');
      const within = query.within ?? '';
      const rows = db.all(
        `SELECT kind, ref, scope, title,
           snippet(fts, 4, '«', '»', '…', 16) AS snippet
         FROM fts
         WHERE fts MATCH ? AND kind IN (${marks})
           AND (? = '' OR scope = ? OR ref = ? OR ref LIKE ?)
         ORDER BY bm25(fts, 0, 0, 0, 4.0, 1.0)
         LIMIT ? OFFSET ?`,
        [query.match, ...kinds, within, within, within, `${within}/%`, query.limit, query.offset],
      );
      return rows.map(toHit);
    },
  };
}
