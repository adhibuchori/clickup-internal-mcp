/**
 * The cache as one object: every store over one SQLite connection, migrated on open. Pruning keeps
 * the newest revision of every page however old it is, so a diff always has a base.
 */
import type { Stores } from '../../ports/store.ts';
import { createAssetIndex } from './asset-index.ts';
import { createDocStore } from './doc-store.ts';
import { migrate } from './schema.ts';
import { createSearchIndex } from './search-index.ts';
import { createMemberStore, createMetaStore } from './small-stores.ts';
import type { SqlDb } from './sqlite.ts';
import { createTaskStore } from './task-store.ts';
import { createTrackStore } from './track-store.ts';
import { transaction } from './rows.ts';

export function createStores(db: SqlDb): Stores {
  migrate(db);
  return {
    tracked: createTrackStore(db),
    docs: createDocStore(db),
    tasks: createTaskStore(db),
    search: createSearchIndex(db),
    assets: createAssetIndex(db),
    members: createMemberStore(db),
    meta: createMetaStore(db),
    prune(before) {
      transaction(db, () => {
        db.run(
          `DELETE FROM page_revisions WHERE at < ? AND (doc_id, page_id, at) NOT IN
             (SELECT doc_id, page_id, MAX(at) FROM page_revisions GROUP BY doc_id, page_id)`,
          [before],
        );
        db.run('DELETE FROM task_events WHERE at < ?', [before]);
      });
    },
    close: () => db.close(),
  };
}
