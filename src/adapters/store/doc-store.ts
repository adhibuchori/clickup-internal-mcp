/**
 * Tracked docs and their pages. Saving compares content hashes with the stored copy, so an
 * unchanged page costs one hash and nothing else; a changed page gets a new revision and a fresh
 * search row. Revisions hold the full text (pages are small) and power the `changes` diff.
 */
import { createHash } from 'node:crypto';
import type { DocSummary, Page } from '../../core/model/clickup.types.ts';
import type { DocStore, PageChange } from '../../ports/store.ts';
import { dropRef, indexRow } from './fts-rows.ts';
import { docSchema, pageSchema } from './json-schemas.ts';
import { int, parseJson, text, textOrNull, transaction } from './rows.ts';
import type { SqlDb } from './sqlite.ts';

interface SaveInput {
  readonly doc: DocSummary;
  readonly scope: string;
  readonly pages: readonly Page[];
  readonly at: number;
  readonly initial: boolean;
}

interface Stored {
  readonly hash: string;
  readonly name: string;
  readonly content: string;
}

interface Revision {
  readonly id: string;
  readonly name: string;
  readonly content: string | null;
}

function hashPage(page: Page): string {
  return createHash('sha256').update(`${page.name}\n${page.content}`).digest('hex');
}

function pageRef(docId: string, pageId: string): string {
  return `doc:${docId}/page:${pageId}`;
}

function writePage(db: SqlDb, input: SaveInput, page: Page): void {
  db.run(
    `INSERT INTO pages (doc_id, id, json, hash) VALUES (?, ?, ?, ?)
     ON CONFLICT (doc_id, id) DO UPDATE SET json = excluded.json, hash = excluded.hash`,
    [input.doc.id, page.id, JSON.stringify(page), hashPage(page)],
  );
  indexRow(db, {
    kind: 'page',
    ref: pageRef(input.doc.id, page.id),
    scope: input.scope,
    title: `${input.doc.name} › ${page.name}`,
    body: page.content,
  });
}

function addRevision(db: SqlDb, input: SaveInput, revision: Revision): void {
  db.run(
    `INSERT INTO page_revisions (doc_id, page_id, at, name, content, initial) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (doc_id, page_id, at) DO UPDATE SET name = excluded.name, content = excluded.content`,
    [input.doc.id, revision.id, input.at, revision.name, revision.content, input.initial ? 1 : 0],
  );
}

function storedPages(db: SqlDb, docId: string): Map<string, Stored> {
  const stored = new Map<string, Stored>();
  for (const row of db.all('SELECT id, json, hash FROM pages WHERE doc_id = ?', [docId])) {
    const page = parseJson(pageSchema, text(row, 'json'));
    stored.set(text(row, 'id'), {
      hash: text(row, 'hash'),
      name: page?.name ?? '',
      content: page?.content ?? '',
    });
  }
  return stored;
}

function removePage(db: SqlDb, input: SaveInput, gone: Stored & { id: string }): PageChange {
  const { id } = gone;
  db.run('DELETE FROM pages WHERE doc_id = ? AND id = ?', [input.doc.id, id]);
  db.run('DELETE FROM page_assets WHERE doc_id = ? AND page_id = ?', [input.doc.id, id]);
  dropRef(db, 'page', pageRef(input.doc.id, id));
  addRevision(db, input, { id, name: gone.name, content: null });
  return {
    docId: input.doc.id,
    docName: input.doc.name,
    at: input.at,
    pageId: id,
    pageName: gone.name,
    kind: 'removed',
    before: gone.content,
    after: null,
  };
}

/** Writes pages that are new or changed; returns their changes. Rewrites search rows on a rename. */
function upsertPages(db: SqlDb, input: SaveInput, stored: Map<string, Stored>): PageChange[] {
  const previous = db.get('SELECT json FROM docs WHERE id = ?', [input.doc.id]);
  const renamed = parseJson(docSchema, text(previous, 'json'))?.name !== input.doc.name;
  const changes: PageChange[] = [];
  for (const page of input.pages) {
    const before = stored.get(page.id);
    stored.delete(page.id);
    const same = before?.hash === hashPage(page);
    if (!same || renamed) writePage(db, input, page);
    if (same) continue;
    addRevision(db, input, { id: page.id, name: page.name, content: page.content });
    changes.push({
      docId: input.doc.id,
      docName: input.doc.name,
      at: input.at,
      pageId: page.id,
      pageName: page.name,
      kind: before ? 'changed' : 'added',
      before: before?.content ?? null,
      after: page.content,
    });
  }
  return changes;
}

function saveDoc(db: SqlDb, input: SaveInput): PageChange[] {
  const stored = storedPages(db, input.doc.id);
  const changes = upsertPages(db, input, stored);
  for (const [id, gone] of stored) changes.push(removePage(db, input, { ...gone, id }));
  db.run(
    `INSERT INTO docs (id, scope, json, synced_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET scope = excluded.scope, json = excluded.json, synced_at = excluded.synced_at`,
    [input.doc.id, input.scope, JSON.stringify(input.doc), input.at],
  );
  return input.initial ? [] : changes;
}

function changeFor(
  db: SqlDb,
  key: { docId: string; pageId: string },
  since: number,
): PageChange | null {
  const { docId, pageId } = key;
  const after = db.get(
    'SELECT at, name, content FROM page_revisions WHERE doc_id = ? AND page_id = ? ORDER BY at DESC LIMIT 1',
    [docId, pageId],
  );
  const before = db.get(
    'SELECT content FROM page_revisions WHERE doc_id = ? AND page_id = ? AND at <= ? ORDER BY at DESC LIMIT 1',
    [docId, pageId, since],
  );
  const beforeText = textOrNull(before, 'content');
  const afterText = textOrNull(after, 'content');
  if (beforeText === afterText) return null;
  const docRow = db.get('SELECT json FROM docs WHERE id = ?', [docId]);
  return {
    docId,
    docName: parseJson(docSchema, text(docRow, 'json'))?.name ?? docId,
    pageId,
    pageName: text(after, 'name'),
    kind: afterText === null ? 'removed' : beforeText === null ? 'added' : 'changed',
    before: beforeText,
    after: afterText,
    at: int(after, 'at'),
  };
}

function removeDoc(db: SqlDb, docId: string): void {
  transaction(db, () => {
    for (const table of ['pages', 'page_revisions', 'page_assets'])
      db.run(`DELETE FROM ${table} WHERE doc_id = ?`, [docId]);
    db.run('DELETE FROM docs WHERE id = ?', [docId]);
    db.run("DELETE FROM fts WHERE kind = 'page' AND ref LIKE ?", [`doc:${docId}/%`]);
  });
}

export function createDocStore(db: SqlDb): DocStore {
  return {
    get(docId) {
      const row = db.get('SELECT * FROM docs WHERE id = ?', [docId]);
      const doc = row ? parseJson(docSchema, text(row, 'json')) : null;
      return doc ? { doc, scope: text(row, 'scope'), syncedAt: int(row, 'synced_at') } : null;
    },
    pages: (docId) =>
      db
        .all('SELECT json FROM pages WHERE doc_id = ?', [docId])
        .map((row) => parseJson(pageSchema, text(row, 'json')))
        .filter((page) => page !== null)
        .toSorted((a, b) => a.position - b.position),
    idsOfScope: (scope) =>
      db
        .all('SELECT id FROM docs WHERE scope = ? ORDER BY id', [scope])
        .map((row) => text(row, 'id')),
    save: (input) => transaction(db, () => saveDoc(db, input)),
    remove: (docId) => removeDoc(db, docId),
    changesSince: (since) =>
      db
        .all(
          'SELECT DISTINCT doc_id, page_id FROM page_revisions WHERE at > ? AND initial = 0 ORDER BY doc_id, page_id',
          [since],
        )
        .map((row) =>
          changeFor(db, { docId: text(row, 'doc_id'), pageId: text(row, 'page_id') }, since),
        )
        .filter((change) => change !== null),
  };
}
