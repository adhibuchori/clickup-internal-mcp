/**
 * The cache schema. SCHEMA_VERSION goes up whenever a table changes; an older file then loses its
 * cached content (it is all fetched again) but keeps the user's tracked list, whose sync state is
 * reset so the next sync starts from scratch.
 */
import type { SqlDb } from './sqlite.ts';
import { int } from './rows.ts';

export const SCHEMA_VERSION = 1;

const TRACKED = `CREATE TABLE IF NOT EXISTS tracked (
  kind TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, added_at INTEGER NOT NULL,
  synced_at INTEGER, watermark INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'ok',
  PRIMARY KEY (kind, id))`;

const CONTENT = [
  'CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  'CREATE TABLE docs (id TEXT PRIMARY KEY, scope TEXT NOT NULL, json TEXT NOT NULL, synced_at INTEGER NOT NULL)',
  'CREATE INDEX docs_scope ON docs (scope)',
  'CREATE TABLE pages (doc_id TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (doc_id, id))',
  'CREATE TABLE page_revisions (doc_id TEXT NOT NULL, page_id TEXT NOT NULL, at INTEGER NOT NULL, name TEXT NOT NULL, content TEXT, initial INTEGER NOT NULL, PRIMARY KEY (doc_id, page_id, at))',
  'CREATE INDEX page_revisions_at ON page_revisions (at)',
  'CREATE TABLE tasks (id TEXT PRIMARY KEY, custom_id TEXT, scope TEXT NOT NULL, json TEXT NOT NULL, synced_at INTEGER NOT NULL)',
  'CREATE INDEX tasks_custom ON tasks (custom_id)',
  'CREATE INDEX tasks_scope ON tasks (scope)',
  'CREATE TABLE comments (task_id TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (task_id, id))',
  'CREATE TABLE task_events (task_id TEXT NOT NULL, name TEXT NOT NULL, at INTEGER NOT NULL, what TEXT NOT NULL)',
  'CREATE INDEX task_events_at ON task_events (at)',
  'CREATE TABLE assets (sha TEXT PRIMARY KEY, ext TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL, source_url TEXT NOT NULL, first_seen INTEGER NOT NULL, note TEXT, noted_at INTEGER)',
  'CREATE TABLE asset_sources (url TEXT PRIMARY KEY, sha TEXT NOT NULL)',
  'CREATE TABLE page_assets (doc_id TEXT NOT NULL, page_id TEXT NOT NULL, sha TEXT NOT NULL, PRIMARY KEY (doc_id, page_id, sha))',
  'CREATE TABLE members (id INTEGER PRIMARY KEY, username TEXT NOT NULL, email TEXT NOT NULL)',
  "CREATE VIRTUAL TABLE fts USING fts5 (kind UNINDEXED, ref UNINDEXED, scope UNINDEXED, title, body, tokenize = 'unicode61 remove_diacritics 2')",
];

const CONTENT_TABLES = [
  'meta',
  'docs',
  'pages',
  'page_revisions',
  'tasks',
  'comments',
  'task_events',
  'assets',
  'asset_sources',
  'page_assets',
  'members',
  'fts',
];

export function migrate(db: SqlDb): void {
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  const version = int(db.get('PRAGMA user_version'), 'user_version');
  if (version === SCHEMA_VERSION) return;
  db.exec(TRACKED);
  for (const table of CONTENT_TABLES) db.exec(`DROP TABLE IF EXISTS ${table}`);
  for (const statement of CONTENT) db.exec(statement);
  db.exec("UPDATE tracked SET synced_at = NULL, watermark = 0, status = 'ok'");
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
