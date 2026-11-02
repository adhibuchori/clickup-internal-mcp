/** Text for `track` and `changes`. */
import { diffLines } from '../../core/diff/line-diff.ts';
import { ago, formatDateTime, plural } from '../../core/output/text.ts';
import type { ChangeReport } from '../../engine/changes/changes.ts';
import type { ScopeSyncResult } from '../../engine/deps/engine-deps.types.ts';
import type { PageChange, Tracked } from '../../ports/store.ts';

export function trackedLine(t: Tracked, now: number): string {
  const synced = t.syncedAt ? `synced ${ago(t.syncedAt, now)}` : 'not synced yet';
  return `${t.kind}:${t.id}  ${t.name} · ${synced} · ${t.status}`;
}

export function formatTracked(all: readonly Tracked[], unnoted: number, now: number): string {
  if (all.length === 0)
    return 'Nothing is tracked.\nHint: {"action": "add", "target": "<doc, list, folder or space URL>"}';
  return [
    `Tracked (${all.length}):`,
    ...all.map((t) => `  ${trackedLine(t, now)}`),
    ...(unnoted > 0
      ? [
          '',
          `${plural(unnoted, 'image')} in tracked docs have no note yet: view_image each, then note_image.`,
        ]
      : []),
  ].join('\n');
}

export function formatSync(result: ScopeSyncResult): string {
  return [
    `${plural(result.docs, 'doc')}, ${plural(result.pageChanges, 'page change')}, ${plural(result.tasks, 'task')} updated, ${plural(result.images, 'image')}`,
    result.failedImages > 0 ? ` (${result.failedImages} could not be downloaded)` : '',
    result.more ? '. More tasks follow on the next sync.' : '.',
  ].join('');
}

function pageBlock(change: PageChange, withDiff: boolean, now: number): string[] {
  const head = `  doc:${change.docId}/page:${change.pageId}  ${change.docName} › ${change.pageName} · ${change.kind} ${ago(change.at, now)}`;
  if (change.kind !== 'changed' || !change.before || !change.after) return [head];
  const diff = diffLines(change.before, change.after);
  const stat = `${head} (+${diff.added} −${diff.removed})`;
  if (!withDiff) return [stat];
  const shown = diff.lines.slice(0, 40).map((line) => `    ${line}`);
  return [
    stat,
    ...shown,
    ...(diff.lines.length > 40 ? ['    … (diff cut; read_doc the page for the rest)'] : []),
  ];
}

export function changeLevels(
  report: ChangeReport,
  now: number,
  timeZone: string,
): (() => string)[] {
  const since = report.since > 0 ? formatDateTime(report.since, timeZone) : 'the start of tracking';
  const render = (withDiff: boolean, maxEvents: number): string => {
    if (report.tracked === 0) return 'Nothing is tracked, so there are no changes to report.';
    if (report.pages.length === 0 && report.tasks.length === 0) return `No changes since ${since}.`;
    return [
      `Changes since ${since}${report.synced > 0 ? ` (synced ${plural(report.synced, 'scope')} first)` : ''}:`,
      ...(report.pages.length > 0
        ? ['Docs:', ...report.pages.flatMap((c) => pageBlock(c, withDiff, now))]
        : []),
      ...(report.tasks.length > 0
        ? [
            'Tasks:',
            ...report.tasks
              .slice(0, maxEvents)
              .map((e) => `  task:${e.taskId}  ${e.name} · ${e.what} · ${ago(e.at, now)}`),
          ]
        : []),
      ...(report.tasks.length > maxEvents
        ? [`  … and ${report.tasks.length - maxEvents} more task events`]
        : []),
    ].join('\n');
  };
  return [() => render(true, 200), () => render(false, 50), () => render(false, 10)];
}
