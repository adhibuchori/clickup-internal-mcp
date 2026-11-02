/**
 * The workspace tree for `browse`: spaces, then the folders and lists of a space, the lists of a
 * folder, and the docs under any of them. Structure changes rarely, so answers are memoised for ten
 * minutes in memory.
 */
import type { DocSummary, Folder, ListInfo, Space } from '../../core/model/clickup.types.ts';
import { PARENT_TYPE } from '../../core/model/parent-type.ts';
import { guard } from '../api/guard.ts';
import type { EngineDeps } from '../deps/engine-deps.types.ts';

export type Container = { readonly kind: 'space' | 'folder' | 'list'; readonly id: string };

export interface SpaceView {
  readonly space: Space;
  readonly folders: readonly Folder[];
  readonly lists: readonly ListInfo[];
  readonly docs: readonly DocSummary[];
}

export interface FolderView {
  readonly folder: Folder;
  readonly docs: readonly DocSummary[];
}

export interface ListView {
  readonly list: ListInfo;
  readonly docs: readonly DocSummary[];
}

const MAX_DOC_PAGES = 10;

/** Docs directly under a container, following cursors up to 1,000 docs. */
export async function docsUnder(deps: EngineDeps, container: Container): Promise<DocSummary[]> {
  const parentType = PARENT_TYPE[container.kind];
  const collect = async (cursor: string | undefined, round: number): Promise<DocSummary[]> => {
    const page = await deps.clickup.docs({
      parentId: container.id,
      parentType,
      ...(cursor ? { cursor } : {}),
    });
    if (!page.nextCursor || round + 1 >= MAX_DOC_PAGES) return page.docs;
    return [...page.docs, ...(await collect(page.nextCursor, round + 1))];
  };
  return guard('docs', () => collect(undefined, 0));
}

export function spaces(deps: EngineDeps): Promise<Space[]> {
  return guard('spaces', () => deps.clickup.spaces());
}

export async function spaceView(deps: EngineDeps, id: string): Promise<SpaceView> {
  const [space, folders, lists, docs] = await Promise.all([
    guard('space', () => deps.clickup.space(id)),
    guard('folders', () => deps.clickup.folders(id)),
    guard('lists', () => deps.clickup.folderlessLists(id)),
    docsUnder(deps, { kind: 'space', id }),
  ]);
  return { space, folders, lists, docs };
}

export async function folderView(deps: EngineDeps, id: string): Promise<FolderView> {
  const [folder, docs] = await Promise.all([
    guard('folder', () => deps.clickup.folder(id)),
    docsUnder(deps, { kind: 'folder', id }),
  ]);
  return { folder, docs };
}

export async function listView(deps: EngineDeps, id: string): Promise<ListView> {
  const [list, docs] = await Promise.all([
    guard('list', () => deps.clickup.list(id)),
    docsUnder(deps, { kind: 'list', id }),
  ]);
  return { list, docs };
}
