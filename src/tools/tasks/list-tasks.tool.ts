/** list_tasks: tasks of a list, folder or space, filtered, 100 per page. */
import { z } from 'zod';
import { ToolError } from '../../core/errors/tool-error.ts';
import { requireRef } from '../../core/refs/refs.ts';
import { parseWhen } from '../../core/time/when.ts';
import type { EngineDeps } from '../../engine/deps/engine-deps.types.ts';
import { me } from '../../engine/people/members.ts';
import { listTasks } from '../../engine/tasks/tasks.ts';
import type { TaskQuery } from '../../ports/clickup.ts';
import { defineTool } from '../registry/define-tool.ts';
import { formatTaskList } from './tasks.format.ts';

async function assigneeIds(
  deps: EngineDeps,
  assignee: string | undefined,
): Promise<number[] | undefined> {
  if (!assignee) return undefined;
  if (assignee.trim().toLowerCase() === 'me') return [(await me(deps)).id];
  if (/^\d+$/.test(assignee.trim())) return [Number(assignee.trim())];
  throw new ToolError(
    'assignee must be "me" or a numeric ClickUp user id.',
    'Example: {"assignee": "me"}',
  );
}

const input = {
  in: z.string().max(2048).describe('A list, folder or space reference or URL.'),
  status: z
    .array(z.string().max(100))
    .max(20)
    .optional()
    .describe('Only these status names, as shown in ClickUp.'),
  assignee: z.string().max(40).optional().describe('"me" or a numeric user id.'),
  tag: z.string().max(100).optional().describe('Only tasks with this tag.'),
  updated_since: z.string().max(40).optional().describe('"7d", "24h" or a date like "2026-11-01".'),
  due_before: z.string().max(40).optional().describe('"2026-11-30" or a relative time.'),
  include_closed: z.boolean().default(false).describe('Include closed tasks.'),
  page: z.number().int().min(0).max(1000).default(0).describe('Page of 100 tasks, from 0.'),
};

export const listTasksTool = defineTool({
  name: 'list_tasks',
  title: 'List ClickUp tasks',
  description:
    'Lists tasks of a ClickUp list, folder or space, newest update first, 100 per page. Filter by status names, assignee ("me"), tag, last update and due date; closed tasks are left out unless asked for. Each line starts with a task reference for read_task. This is a live read; for text search over tracked tasks use search.\nExample: {"in": "list:901812345678", "assignee": "me", "updated_since": "7d"}',
  input,
  async run(args, { deps }) {
    const scope = requireRef(args.in, ['list', 'folder', 'space']);
    const now = deps.clock.now();
    const tz = deps.config.timeZone;
    const query: TaskQuery = {
      page: args.page,
      orderBy: 'updated',
      includeClosed: args.include_closed,
      ...(scope.kind === 'list'
        ? { listIds: [scope.id] }
        : scope.kind === 'folder'
          ? { folderIds: [scope.id] }
          : { spaceIds: [scope.id] }),
      ...(args.status ? { statuses: args.status } : {}),
      ...(args.tag ? { tags: [args.tag] } : {}),
      ...(args.updated_since ? { updatedAfter: parseWhen(args.updated_since, now, tz) } : {}),
      ...(args.due_before ? { dueBefore: parseWhen(args.due_before, now, tz) } : {}),
    };
    const assignees = await assigneeIds(deps, args.assignee);
    const result = await listTasks(deps, assignees ? { ...query, assignees } : query);
    return formatTaskList(result, args.page, { now, timeZone: tz });
  },
});
