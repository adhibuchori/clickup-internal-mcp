/** The tracked scopes: what the user chose to keep on this laptop. */
import type { ScopeKind, Tracked, TrackStore } from '../../ports/store.ts';
import { int, intOrNull, text } from './rows.ts';
import type { SqlDb, SqlRow } from './sqlite.ts';

const KINDS: readonly ScopeKind[] = ['doc', 'list', 'folder', 'space'];

function toTracked(row: SqlRow): Tracked {
  const kind = KINDS.find((k) => k === text(row, 'kind')) ?? 'doc';
  return {
    kind,
    id: text(row, 'id'),
    name: text(row, 'name'),
    addedAt: int(row, 'added_at'),
    syncedAt: intOrNull(row, 'synced_at'),
    watermark: int(row, 'watermark'),
    status: text(row, 'status'),
  };
}

export function createTrackStore(db: SqlDb): TrackStore {
  return {
    list: () => db.all('SELECT * FROM tracked ORDER BY added_at, kind, id').map(toTracked),
    get(kind, id) {
      const row = db.get('SELECT * FROM tracked WHERE kind = ? AND id = ?', [kind, id]);
      return row ? toTracked(row) : null;
    },
    put(t) {
      db.run(
        `INSERT INTO tracked (kind, id, name, added_at, synced_at, watermark, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (kind, id) DO UPDATE SET name = excluded.name, synced_at = excluded.synced_at,
           watermark = excluded.watermark, status = excluded.status`,
        [t.kind, t.id, t.name, t.addedAt, t.syncedAt, t.watermark, t.status],
      );
    },
    remove: (kind, id) => db.run('DELETE FROM tracked WHERE kind = ? AND id = ?', [kind, id]),
  };
}
