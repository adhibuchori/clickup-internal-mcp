/** track: choose what is kept on this machine, and sync it. */
import { z } from 'zod';
import { ToolError } from '../../core/errors/tool-error.ts';
import { requireRef } from '../../core/refs/refs.ts';
import type { EngineDeps } from '../../engine/deps/engine-deps.types.ts';
import { runSync, type Scope, syncStale, track, untrack } from '../../engine/sync/tracking.ts';
import { defineTool } from '../registry/define-tool.ts';
import { formatSync, formatTracked, trackedLine } from './tracking.format.ts';

function scopeOf(target: string | undefined): Scope {
  if (!target)
    throw new ToolError(
      'This action needs a target.',
      'Pass a doc, list, folder or space reference or URL.',
    );
  const ref = requireRef(target, ['doc', 'list', 'folder', 'space']);
  return ref.kind === 'doc' ? { kind: 'doc', id: ref.docId } : ref;
}

async function add(deps: EngineDeps, scope: Scope): Promise<string> {
  const outcome = await track(deps, scope);
  const line = trackedLine(outcome.tracked, deps.clock.now());
  if (outcome.state === 'background')
    return `Tracking ${line}\nThe first sync is still running in the background. Call track with action "list" to see when it is done.`;
  return `Tracking ${line}\nSynced: ${formatSync(outcome.result)}`;
}

async function sync(deps: EngineDeps, target: string | undefined): Promise<string> {
  if (!target)
    return `Synced ${await syncStale(deps, 0)} scopes.\n${formatTracked(deps.stores.tracked.list(), deps.stores.assets.unnoted(1000).length, deps.clock.now())}`;
  const scope = scopeOf(target);
  const tracked = deps.stores.tracked.get(scope.kind, scope.id);
  if (!tracked)
    throw new ToolError(
      `${scope.kind}:${scope.id} is not tracked.`,
      'Use action "add" to track it first.',
    );
  return `Synced: ${formatSync(await runSync(deps, tracked))}`;
}

export const trackTool = defineTool({
  name: 'track',
  title: 'Track ClickUp content locally',
  description:
    'Chooses what is kept in the local cache, which makes it searchable, diffable and readable offline. "add" a doc, list, folder or space (its docs, tasks, comments and images are synced now); "remove" deletes everything cached for it; "list" shows what is tracked and how fresh; "sync" refreshes one scope or all. Nothing is ever changed in ClickUp. Keep scopes narrow: only what the work needs.\nExample: {"action": "add", "target": "https://app.clickup.com/9018/v/dc/8cdu22c-13133"}',
  input: {
    action: z.enum(['add', 'remove', 'list', 'sync']).describe('What to do.'),
    target: z
      .string()
      .max(2048)
      .optional()
      .describe(
        'A doc, list, folder or space reference or URL (not needed for list, optional for sync).',
      ),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  async run({ action, target }, { deps }) {
    if (action === 'list')
      return formatTracked(
        deps.stores.tracked.list(),
        deps.stores.assets.unnoted(1000).length,
        deps.clock.now(),
      );
    if (action === 'sync') return sync(deps, target);
    const scope = scopeOf(target);
    if (action === 'add') return add(deps, scope);
    const removed = untrack(deps, scope);
    return `Stopped tracking ${removed.kind}:${removed.id} ${removed.name} and deleted its cached content.`;
  },
});
