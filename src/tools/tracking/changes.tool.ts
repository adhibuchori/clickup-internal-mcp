/** changes: what moved in tracked docs and tasks since the last look or a date. */
import { z } from 'zod';
import { pickLevel } from '../../core/output/budget.ts';
import { parseWhen } from '../../core/time/when.ts';
import { collectChanges } from '../../engine/changes/changes.ts';
import { defineTool } from '../registry/define-tool.ts';
import { changeLevels } from './tracking.format.ts';

export const changesTool = defineTool({
  name: 'changes',
  title: 'What changed in tracked content',
  description:
    'Reports what changed in tracked content: doc pages edited (with a line diff), added or removed, and task events such as status, assignee, priority or description changes. Without `since` it reports changes since the previous call and moves that mark forward; with `since` ("7d", "2026-11-01") it reports from then and leaves the mark alone. Stale scopes are synced first unless sync is false.\nExample: {"since": "7d"}',
  input: {
    since: z
      .string()
      .max(40)
      .optional()
      .describe('"7d", "24h", a date, or omit for "since my last look".'),
    sync: z.boolean().default(true).describe('Sync scopes older than ten minutes first.'),
  },
  async run({ since, sync }, { deps, budget }) {
    const now = deps.clock.now();
    const from = since ? parseWhen(since, now, deps.config.timeZone) : null;
    const report = await collectChanges(deps, { since: from, sync });
    return pickLevel(changeLevels(report, now, deps.config.timeZone), budget - 100);
  },
});
