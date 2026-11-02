import { afterEach, beforeEach, expect, test } from 'bun:test';
import { join } from 'node:path';
import { createStores } from '../open-store.ts';
import { SCHEMA_VERSION } from '../schema.ts';
import { loadSqlite } from '../sqlite.ts';
import { doc, openTestDb, page } from './store-helpers.ts';

let t: Awaited<ReturnType<typeof openTestDb>>;
beforeEach(async () => {
  t = await openTestDb();
});
afterEach(() => t.dispose());

test('tracked scopes, meta values and member names round-trip', () => {
  const tracked = {
    kind: 'list' as const,
    id: '300',
    name: 'Sprint',
    addedAt: 1,
    syncedAt: 2,
    watermark: 3,
    status: 'ok',
  };
  t.stores.tracked.put(tracked);
  t.stores.tracked.put({ ...tracked, kind: 'doc', id: 'd-1' });
  expect(t.stores.tracked.get('list', '300')).toEqual(tracked);
  expect(t.stores.tracked.list().map((x) => x.kind)).toEqual(['doc', 'list']);
  t.stores.tracked.remove('list', '300');
  expect(t.stores.tracked.get('list', '300')).toBeNull();
  t.db.run("UPDATE tracked SET kind = 'weird'");
  expect(t.stores.tracked.list()[0]?.kind).toBe('doc');
  expect(t.stores.meta.get('k')).toBeNull();
  t.stores.meta.set('k', 'v');
  t.stores.meta.set('k', 'w');
  expect(t.stores.meta.get('k')).toBe('w');
  t.stores.members.save([{ id: 1, username: 'alice', email: '' }]);
  expect(t.stores.members.names([1, 2, 1])).toEqual(new Map([[1, 'alice']]));
});

test('assets: by source, by unique prefix, links, notes and orphans', () => {
  const asset = {
    sha: 'ab'.repeat(32),
    ext: 'png',
    mime: 'image/png',
    bytes: 3,
    sourceUrl: 'https://x/a.png',
  };
  t.stores.assets.put(asset, 1);
  t.stores.assets.put({ ...asset, sha: 'ac'.repeat(32), sourceUrl: 'https://x/b.png' }, 1);
  expect(t.stores.assets.bySource('https://x/a.png')).toEqual(asset);
  expect(t.stores.assets.bySource('https://x/none')).toBeNull();
  expect(t.stores.assets.byPrefix('abababab')?.sha).toBe(asset.sha);
  expect(t.stores.assets.byPrefix('a')).toBeNull();
  expect(t.stores.assets.byPrefix('zzzzzzzz')).toBeNull();
  t.stores.assets.link('d-1', 'p-1', [asset.sha, asset.sha]);
  expect(t.stores.assets.unnoted(10).map((a) => a.sha)).toEqual([asset.sha]);
  t.stores.assets.setNote(asset.sha, 'Login form', 2);
  expect(t.stores.assets.note(asset.sha)).toBe('Login form');
  expect(t.stores.assets.unnoted(10)).toEqual([]);
  expect(t.stores.assets.orphans().map((a) => a.sha)).toEqual(['ac'.repeat(32)]);
  t.stores.assets.remove('ac'.repeat(32));
  expect(t.stores.assets.bySource('https://x/b.png')).toBeNull();
});

test('prune keeps the newest revision of every page and drops old events', () => {
  t.stores.docs.save({ doc: doc(), scope: 's', pages: [page()], at: 10, initial: true });
  t.stores.docs.save({
    doc: doc(),
    scope: 's',
    pages: [page({ content: 'two' })],
    at: 20,
    initial: false,
  });
  t.db.run("INSERT INTO task_events (task_id, name, at, what) VALUES ('t', 'n', 5, 'w')");
  t.stores.prune(100);
  expect(t.db.all('SELECT at FROM page_revisions').map((r) => r['at'])).toEqual([20]);
  expect(t.db.all('SELECT * FROM task_events')).toEqual([]);
});

test('a failed transaction leaves nothing behind', () => {
  t.db.exec('DROP TABLE page_revisions');
  expect(() =>
    t.stores.docs.save({
      doc: doc({ id: 'd-2' }),
      scope: 's',
      pages: [page({ docId: 'd-2' })],
      at: 2,
      initial: true,
    }),
  ).toThrow();
  expect(t.stores.docs.get('d-2')).toBeNull();
});

test('an older schema loses its content but keeps the tracked list, reset for a fresh sync', async () => {
  t.stores.tracked.put({
    kind: 'doc',
    id: 'd-1',
    name: 'D',
    addedAt: 1,
    syncedAt: 5,
    watermark: 9,
    status: 'ok',
  });
  t.stores.docs.save({ doc: doc(), scope: 'doc:d-1', pages: [page()], at: 10, initial: true });
  t.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 5}`);
  t.stores.close();
  const reopened = createStores((await loadSqlite())(join(t.dir, 'store.db'), { readonly: false }));
  expect(reopened.tracked.list()[0]).toMatchObject({ syncedAt: null, watermark: 0 });
  expect(reopened.docs.get('d-1')).toBeNull();
  reopened.close();
});
