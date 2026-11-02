/** A real SQLite cache in a temporary folder, plus domain objects to save into it. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DocSummary, Page, Task } from '../../../core/model/clickup.types.ts';
import type { Stores } from '../../../ports/store.ts';
import { createStores } from '../open-store.ts';
import { loadSqlite, type SqlDb } from '../sqlite.ts';

export async function openTestDb(): Promise<{
  db: SqlDb;
  stores: Stores;
  dir: string;
  dispose(): void;
}> {
  const dir = mkdtempSync(join(tmpdir(), 'clickup-store-'));
  const db = (await loadSqlite())(join(dir, 'store.db'), { readonly: false });
  const stores = createStores(db);
  return {
    db,
    stores,
    dir,
    dispose: () => (stores.close(), rmSync(dir, { recursive: true, force: true })),
  };
}

export function doc(over: Partial<DocSummary> = {}): DocSummary {
  return {
    id: 'd-1',
    name: 'Doc',
    parentId: '300',
    parentType: 6,
    creator: 1,
    dateCreated: 1,
    dateUpdated: 2,
    ...over,
  };
}

export function page(over: Partial<Page> = {}): Page {
  return {
    id: 'p-1',
    docId: 'd-1',
    parentPageId: null,
    name: 'Page',
    content: 'hello world',
    dateUpdated: 1,
    authors: [],
    position: 0,
    depth: 0,
    ...over,
  };
}

export function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    customId: 'MOB-1',
    name: 'Task',
    url: 'u',
    status: 'open',
    statusType: 'open',
    listId: '300',
    listName: 'L',
    folderId: null,
    folderName: null,
    spaceId: '100',
    assignees: ['alice'],
    tags: ['a'],
    priority: null,
    dueDate: null,
    startDate: null,
    dateCreated: 1,
    dateUpdated: 2,
    dateClosed: null,
    creator: 'bob',
    parentId: null,
    description: 'desc',
    customFields: [{ name: 'Channel', value: 'Mobile' }],
    subtasks: [],
    attachments: [],
    ...over,
  };
}
