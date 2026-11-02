/** Member names and small key/value settings. */
import type { MemberStore, MetaStore } from '../../ports/store.ts';
import { int, text, transaction } from './rows.ts';
import type { SqlDb } from './sqlite.ts';

export function createMemberStore(db: SqlDb): MemberStore {
  return {
    names(ids) {
      const names = new Map<number, string>();
      for (const id of new Set(ids)) {
        const row = db.get('SELECT id, username FROM members WHERE id = ?', [id]);
        if (row) names.set(int(row, 'id'), text(row, 'username'));
      }
      return names;
    },
    save(members) {
      transaction(db, () => {
        for (const m of members)
          db.run(
            `INSERT INTO members (id, username, email) VALUES (?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET username = excluded.username, email = excluded.email`,
            [m.id, m.username, m.email],
          );
      });
    },
  };
}

export function createMetaStore(db: SqlDb): MetaStore {
  return {
    get(key) {
      const row = db.get('SELECT value FROM meta WHERE key = ?', [key]);
      return row ? text(row, 'value') : null;
    },
    set(key, value) {
      db.run(
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
        [key, value],
      );
    },
  };
}
