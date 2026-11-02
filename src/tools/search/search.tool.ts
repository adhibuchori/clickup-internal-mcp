/** search: full-text over tracked docs, tasks and comments, from the local index. */
import { z } from 'zod';
import { decodeCursor, encodeCursor, requestKey } from '../../core/output/cursor.ts';
import { formatRef, parseRef } from '../../core/refs/refs.ts';
import { searchLocal } from '../../engine/search/search.ts';
import type { HitKind } from '../../ports/store.ts';
import { defineTool } from '../registry/define-tool.ts';
import { cursorField, limitField } from '../registry/shared-input.ts';
import { formatHits } from './search.format.ts';

const KIND: Readonly<Record<'docs' | 'tasks' | 'comments', HitKind>> = {
  docs: 'page',
  tasks: 'task',
  comments: 'comment',
};

/** "list:1" stays a scope; "doc:x" or a doc URL narrows to that doc's pages. */
function within(input: string | undefined): string | null {
  if (!input) return null;
  const ref = parseRef(input);
  if (!ref || ref.kind === 'image' || ref.kind === 'task') return input.trim();
  return ref.kind === 'doc' ? `doc:${ref.docId}` : formatRef(ref);
}

export const searchTool = defineTool({
  name: 'search',
  title: 'Search tracked content',
  description:
    'Full-text search over everything tracked on this machine: doc pages, tasks and comments, ranked with titles first. Words match as prefixes ("bayar" finds "pembayaran"); "quoted phrases" match exactly; when no result has every word, results with any word are shown and the answer says so. Only tracked content is searchable; ClickUp itself has no text search API.\nExample: {"query": "checkout shipping address", "kinds": ["docs"]}',
  input: {
    query: z.string().min(1).max(300).describe('Words or "a phrase" to find.'),
    kinds: z
      .array(z.enum(['docs', 'tasks', 'comments']))
      .max(3)
      .optional()
      .describe('Limit to these kinds. Omit for all.'),
    in: z
      .string()
      .max(2048)
      .optional()
      .describe('Only inside this tracked doc, list, folder or space.'),
    limit: limitField(10, 50),
    cursor: cursorField,
  },
  async run({ query, kinds, in: scope, limit, cursor }, { deps }) {
    const key = requestKey([query, kinds ?? [], scope ?? '', limit]);
    const offset = decodeCursor(cursor, key);
    const result = searchLocal(deps, {
      query,
      kinds: (kinds ?? []).map((k) => KIND[k]),
      within: within(scope),
      limit,
      offset,
    });
    const next = result.hits.length > limit ? encodeCursor(offset + limit, key) : null;
    return formatHits(result, { query, limit, offset, next });
  },
});
