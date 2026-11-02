/** browse: walk the workspace from spaces down to lists and docs. */
import { z } from 'zod';
import { requireRef } from '../../core/refs/refs.ts';
import { folderView, listView, spaces, spaceView } from '../../engine/browse/hierarchy.ts';
import type { EngineDeps } from '../../engine/deps/engine-deps.types.ts';
import { defineTool } from '../registry/define-tool.ts';
import { formatFolder, formatList, formatSpace, formatSpaces } from './browse.format.ts';

async function render(deps: EngineDeps, target: string | undefined): Promise<string> {
  const now = deps.clock.now();
  if (!target) return formatSpaces(await spaces(deps));
  const ref = requireRef(target, ['space', 'folder', 'list']);
  if (ref.kind === 'space') return formatSpace(await spaceView(deps, ref.id), now);
  if (ref.kind === 'folder') return formatFolder(await folderView(deps, ref.id), now);
  return formatList(await listView(deps, ref.id), now);
}

export const browseTool = defineTool({
  name: 'browse',
  title: 'Browse the workspace',
  description:
    'Walks the ClickUp workspace: with no target it lists the spaces; with a space it shows its folders, lists and docs; with a folder or list it shows what is inside. Every line starts with a reference (space:, folder:, list:, doc:) to pass to the other tools. ClickUp URLs are accepted as targets. Results are remembered for ten minutes; pass fresh to reload.\nExample: {"target": "space:90180123456"}',
  input: {
    target: z
      .string()
      .max(2048)
      .optional()
      .describe('A space, folder or list reference or URL. Omit to list spaces.'),
    fresh: z
      .boolean()
      .default(false)
      .describe('Reload from ClickUp instead of the ten-minute memory.'),
  },
  async run({ target, fresh }, { deps }) {
    const key = `browse:${target?.trim() ?? ''}`;
    const cached = fresh ? undefined : deps.memo.text.get(key);
    if (cached) return cached;
    const text = await render(deps, target);
    deps.memo.text.set(key, text);
    return text;
  },
});
