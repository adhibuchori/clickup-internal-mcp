/**
 * Downloaded images, addressed by the SHA-256 of their bytes: the same mockup pasted into three
 * pages is one file and one note. A source URL maps to the sha it produced, so a re-sync never
 * downloads an image it already has.
 */
import type { Asset, AssetIndex } from '../../ports/store.ts';
import { int, text, textOrNull, transaction } from './rows.ts';
import type { SqlDb, SqlRow } from './sqlite.ts';

function toAsset(row: SqlRow): Asset {
  return {
    sha: text(row, 'sha'),
    ext: text(row, 'ext'),
    mime: text(row, 'mime'),
    bytes: int(row, 'bytes'),
    sourceUrl: text(row, 'source_url'),
  };
}

function put(db: SqlDb, asset: Asset, at: number): void {
  transaction(db, () => {
    db.run(
      `INSERT INTO assets (sha, ext, mime, bytes, source_url, first_seen) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (sha) DO NOTHING`,
      [asset.sha, asset.ext, asset.mime, asset.bytes, asset.sourceUrl, at],
    );
    db.run(
      'INSERT INTO asset_sources (url, sha) VALUES (?, ?) ON CONFLICT (url) DO UPDATE SET sha = excluded.sha',
      [asset.sourceUrl, asset.sha],
    );
  });
}

function link(db: SqlDb, page: { docId: string; pageId: string }, shas: readonly string[]): void {
  transaction(db, () => {
    db.run('DELETE FROM page_assets WHERE doc_id = ? AND page_id = ?', [page.docId, page.pageId]);
    for (const sha of new Set(shas))
      db.run('INSERT INTO page_assets (doc_id, page_id, sha) VALUES (?, ?, ?)', [
        page.docId,
        page.pageId,
        sha,
      ]);
  });
}

function remove(db: SqlDb, sha: string): void {
  transaction(db, () => {
    db.run('DELETE FROM asset_sources WHERE sha = ?', [sha]);
    db.run('DELETE FROM assets WHERE sha = ?', [sha]);
  });
}

function lookups(db: SqlDb): Pick<AssetIndex, 'bySource' | 'byPrefix' | 'unnoted' | 'orphans'> {
  return {
    bySource(url) {
      const row = db.get(
        'SELECT a.* FROM asset_sources s JOIN assets a ON a.sha = s.sha WHERE s.url = ?',
        [url],
      );
      return row ? toAsset(row) : null;
    },
    byPrefix(prefix) {
      if (!/^[0-9a-f]{8,64}$/.test(prefix)) return null;
      const rows = db.all('SELECT * FROM assets WHERE sha LIKE ? LIMIT 2', [`${prefix}%`]);
      return rows.length === 1 && rows[0] ? toAsset(rows[0]) : null;
    },
    unnoted: (limit) =>
      db
        .all(
          `SELECT DISTINCT a.* FROM assets a JOIN page_assets p ON p.sha = a.sha
           WHERE a.note IS NULL ORDER BY a.first_seen, a.sha LIMIT ?`,
          [limit],
        )
        .map(toAsset),
    orphans: () =>
      db
        .all('SELECT * FROM assets WHERE sha NOT IN (SELECT sha FROM page_assets) ORDER BY sha')
        .map(toAsset),
  };
}

export function createAssetIndex(db: SqlDb): AssetIndex {
  return {
    ...lookups(db),
    put: (asset, at) => put(db, asset, at),
    link: (docId, pageId, shas) => link(db, { docId, pageId }, shas),
    note: (sha) => textOrNull(db.get('SELECT note FROM assets WHERE sha = ?', [sha]), 'note'),
    setNote: (sha, note, at) =>
      db.run('UPDATE assets SET note = ?, noted_at = ? WHERE sha = ?', [note, at, sha]),
    remove: (sha) => remove(db, sha),
  };
}
