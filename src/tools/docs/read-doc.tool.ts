/** read_doc: a ClickUp doc's outline, one page, or all of it, as Markdown. */
import { z } from 'zod';
import { requireRef } from '../../core/refs/refs.ts';
import { loadDoc } from '../../engine/docs/doc-loader.ts';
import { memberNames } from '../../engine/people/members.ts';
import { defineTool } from '../registry/define-tool.ts';
import { cursorField, freshField } from '../registry/shared-input.ts';
import { formatHeader } from './docs.format.ts';
import { docBody, pickPage } from './docs.service.ts';

export const readDocTool = defineTool({
  name: 'read_doc',
  title: 'Read a ClickUp doc',
  description:
    'Reads a ClickUp doc as Markdown. A doc reference shows the page outline (or the page itself when there is only one); a page reference, or `page` with a page name, shows that page; mode "full" shows every page. Images appear as img: references with any saved note, and Figma, whiteboard and other embeds are listed at the end. Tracked docs come from the local cache (re-synced when stale); others are read live.\nExample: {"doc": "https://app.clickup.com/9018/v/dc/8cdu22c-13133/8cdu22c-4321"}',
  input: {
    doc: z.string().max(2048).describe('A doc or page reference, or a ClickUp doc URL.'),
    page: z
      .string()
      .max(200)
      .optional()
      .describe('A page id or (part of) a page name in this doc.'),
    mode: z
      .enum(['auto', 'outline', 'full'])
      .default('auto')
      .describe('auto: outline, or the page when one is named or the doc has one page.'),
    fresh: freshField,
    cursor: cursorField,
  },
  async run({ doc, page, mode, fresh, cursor }, { deps, budget }) {
    const ref = requireRef(doc, ['doc']);
    const loaded = await loadDoc(deps, ref.docId, fresh);
    const wanted = page ?? ref.pageId;
    const chosen = wanted ? pickPage(loaded.pages, wanted) : null;
    const creator = (await memberNames(deps, [loaded.doc.creator])).get(loaded.doc.creator) ?? '';
    const header = formatHeader(loaded, creator, deps.clock.now());
    const body = docBody(deps, {
      loaded,
      page: chosen,
      mode,
      cursor,
      room: budget - header.length - 200,
    });
    return `${header}\n\n${body}`;
  },
});
