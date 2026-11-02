/** Text for `browse`: one line per thing, each starting with the reference to pass on. */
import type { DocSummary, Folder, ListInfo, Space } from '../../core/model/clickup.types.ts';
import { ago, plural } from '../../core/output/text.ts';
import type { FolderView, ListView, SpaceView } from '../../engine/browse/hierarchy.ts';

function listLine(list: ListInfo, indent: string): string {
  const count = list.taskCount === null ? '' : ` (${plural(list.taskCount, 'task')})`;
  return `${indent}list:${list.id}  ${list.name}${count}`;
}

function docLines(docs: readonly DocSummary[], now: number): string[] {
  if (docs.length === 0) return [];
  return [
    `Docs (${docs.length}):`,
    ...docs.map(
      (d) =>
        `  doc:${d.id}  ${d.name}${d.dateUpdated ? ` · updated ${ago(d.dateUpdated, now)}` : ''}`,
    ),
  ];
}

function folderLines(folder: Folder): string[] {
  return [
    `  folder:${folder.id}  ${folder.name} (${plural(folder.lists.length, 'list')})`,
    ...folder.lists.map((l) => listLine(l, '    ')),
  ];
}

export function formatSpaces(spaces: readonly Space[]): string {
  if (spaces.length === 0) return 'Your account sees no spaces in this workspace.';
  return [
    `Spaces (${spaces.length}):`,
    ...spaces.map((s) => `  space:${s.id}  ${s.name}`),
    '',
    'Next: browse a space to see its folders, lists and docs.',
  ].join('\n');
}

export function formatSpace(view: SpaceView, now: number): string {
  return [
    `Space: ${view.space.name} (space:${view.space.id})`,
    ...(view.folders.length > 0 ? ['Folders:', ...view.folders.flatMap(folderLines)] : []),
    ...(view.lists.length > 0
      ? ['Lists outside folders:', ...view.lists.map((l) => listLine(l, '  '))]
      : []),
    ...docLines(view.docs, now),
    '',
    'Next: read_doc a doc, list_tasks a list, or track a scope to cache and search it.',
  ].join('\n');
}

export function formatFolder(view: FolderView, now: number): string {
  return [
    `Folder: ${view.folder.name} (folder:${view.folder.id})${view.folder.spaceId ? ` in space:${view.folder.spaceId}` : ''}`,
    `Lists (${view.folder.lists.length}):`,
    ...view.folder.lists.map((l) => listLine(l, '  ')),
    ...docLines(view.docs, now),
  ].join('\n');
}

export function formatList(view: ListView, now: number): string {
  const where = [
    view.list.folderName ? `folder ${view.list.folderName}` : '',
    view.list.spaceId ? `space:${view.list.spaceId}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return [
    `List: ${view.list.name} (list:${view.list.id})${where ? ` in ${where}` : ''}`,
    ...(view.list.taskCount === null ? [] : [plural(view.list.taskCount, 'task')]),
    ...docLines(view.docs, now),
    '',
    `Next: list_tasks with in "list:${view.list.id}".`,
  ].join('\n');
}
