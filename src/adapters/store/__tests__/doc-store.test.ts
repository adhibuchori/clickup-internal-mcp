import { afterEach, beforeEach, expect, test } from 'bun:test';
import { doc, openTestDb, page } from './store-helpers.ts';

let t: Awaited<ReturnType<typeof openTestDb>>;
beforeEach(async () => {
  t = await openTestDb();
});
afterEach(() => t.dispose());

test('a first sync stores pages without reporting them as changes', () => {
  const changes = t.stores.docs.save({
    doc: doc(),
    scope: 'doc:d-1',
    pages: [page(), page({ id: 'p-2', position: 1, name: 'Two' })],
    at: 10,
    initial: true,
  });
  expect(changes).toEqual([]);
  expect(t.stores.docs.get('d-1')).toMatchObject({ scope: 'doc:d-1', syncedAt: 10 });
  expect(t.stores.docs.pages('d-1').map((p) => p.id)).toEqual(['p-1', 'p-2']);
  expect(t.stores.docs.idsOfScope('doc:d-1')).toEqual(['d-1']);
  expect(t.stores.docs.get('nope')).toBeNull();
});

test('later syncs report added, changed and removed pages, and changesSince diffs them', () => {
  t.stores.docs.save({
    doc: doc(),
    scope: 's',
    pages: [page(), page({ id: 'p-2', content: 'old' })],
    at: 10,
    initial: true,
  });
  const changes = t.stores.docs.save({
    doc: doc(),
    scope: 's',
    pages: [page(), page({ id: 'p-3', content: 'new page' }), page({ id: 'p-4', content: 'x' })],
    at: 20,
    initial: false,
  });
  expect(changes.map((c) => [c.pageId, c.kind])).toEqual([
    ['p-3', 'added'],
    ['p-4', 'added'],
    ['p-2', 'removed'],
  ]);
  t.stores.docs.save({
    doc: doc(),
    scope: 's',
    pages: [page({ content: 'hello there' }), page({ id: 'p-3', content: 'new page' })],
    at: 30,
    initial: false,
  });
  const since = t.stores.docs.changesSince(15);
  expect(since.map((c) => [c.pageId, c.kind])).toEqual([
    ['p-1', 'changed'],
    ['p-2', 'removed'],
    ['p-3', 'added'],
  ]);
  expect(since[0]).toMatchObject({ before: 'hello world', after: 'hello there', docName: 'Doc' });
  expect(t.stores.docs.changesSince(25).map((c) => c.pageId)).toEqual(['p-1', 'p-4']);
});

test('a page edited and edited back is not a change; a rename refreshes search titles', () => {
  t.stores.docs.save({ doc: doc(), scope: 's', pages: [page()], at: 10, initial: true });
  t.stores.docs.save({
    doc: doc(),
    scope: 's',
    pages: [page({ content: 'temp' })],
    at: 20,
    initial: false,
  });
  t.stores.docs.save({ doc: doc(), scope: 's', pages: [page()], at: 30, initial: false });
  expect(t.stores.docs.changesSince(15)).toEqual([]);
  t.stores.docs.save({
    doc: doc({ name: 'Renamed' }),
    scope: 's',
    pages: [page()],
    at: 40,
    initial: false,
  });
  const hits = t.stores.search.search({
    match: '"hello"*',
    kinds: ['page'],
    within: null,
    limit: 5,
    offset: 0,
  });
  expect(hits[0]?.title).toBe('Renamed › Page');
});

test('remove drops the doc, its pages and its search rows; a doc missing from docs keeps its id', () => {
  t.stores.docs.save({ doc: doc(), scope: 's', pages: [page()], at: 10, initial: true });
  t.stores.docs.save({
    doc: doc(),
    scope: 's',
    pages: [page({ content: 'b' })],
    at: 20,
    initial: false,
  });
  t.db.run('DELETE FROM docs');
  expect(t.stores.docs.changesSince(15)[0]?.docName).toBe('d-1');
  t.stores.docs.remove('d-1');
  expect(t.stores.docs.pages('d-1')).toEqual([]);
  expect(
    t.stores.search.search({ match: '"hello"*', kinds: [], within: null, limit: 5, offset: 0 }),
  ).toEqual([]);
});
