/**
 * Rows of the full-text index. Every stored page, task and comment has exactly one row per ref and
 * kind; writers replace it whole. Image Markdown and bare URLs are dropped from the indexed body, so
 * a search for "jpeg" or "clickup" does not match every page.
 */
import type { HitKind } from '../../ports/store.ts';
import type { SqlDb } from './sqlite.ts';

export interface FtsRow {
  readonly kind: HitKind;
  readonly ref: string;
  readonly scope: string;
  readonly title: string;
  readonly body: string;
}

function searchable(body: string): string {
  return body
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
}

export function indexRow(db: SqlDb, row: FtsRow): void {
  db.run('DELETE FROM fts WHERE kind = ? AND ref = ?', [row.kind, row.ref]);
  db.run('INSERT INTO fts (kind, ref, scope, title, body) VALUES (?, ?, ?, ?, ?)', [
    row.kind,
    row.ref,
    row.scope,
    row.title,
    searchable(row.body),
  ]);
}

export function dropRef(db: SqlDb, kind: HitKind, ref: string): void {
  db.run('DELETE FROM fts WHERE kind = ? AND ref = ?', [kind, ref]);
}
