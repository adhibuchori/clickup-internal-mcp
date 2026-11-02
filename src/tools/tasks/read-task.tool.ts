/** read_task: one task in full, with its comments. */
import { z } from 'zod';
import { pickLevel } from '../../core/output/budget.ts';
import { requireRef } from '../../core/refs/refs.ts';
import { loadComments, loadTask } from '../../engine/tasks/tasks.ts';
import { defineTool } from '../registry/define-tool.ts';
import { taskLevels } from './tasks.format.ts';

export const readTaskTool = defineTool({
  name: 'read_task',
  title: 'Read a ClickUp task',
  description:
    'Reads one ClickUp task: status, assignees, dates, description (Markdown), custom fields, subtasks, attachments and comments. Accepts task:<id>, a custom id such as task:ABC-123, or a task URL. Tasks are read live so status is current; when ClickUp cannot be reached, a tracked copy is shown with a note.\nExample: {"task": "https://app.clickup.com/t/86c1abcde", "comments": true}',
  input: {
    task: z.string().max(2048).describe('A task reference, custom id or task URL.'),
    comments: z.boolean().default(true).describe('Include comments (one more request).'),
  },
  async run({ task, comments }, { deps, budget }) {
    const ref = requireRef(task, ['task']);
    const loaded = await loadTask(deps, ref.id, ref.custom);
    const thread = comments ? await loadComments(deps, loaded.task.id) : null;
    const text = pickLevel(
      taskLevels(loaded.task, thread, { now: deps.clock.now(), timeZone: deps.config.timeZone }),
      budget - 200,
    );
    return loaded.warning ? `Note: ${loaded.warning}\n${text}` : text;
  },
});
