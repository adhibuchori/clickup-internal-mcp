/**
 * Local full-text search. All words must match first; when that finds nothing, any word may match,
 * and the answer says so. The index only holds tracked content, which the answer also says when it
 * is empty.
 */
import { ToolError } from '../../core/errors/tool-error.ts';
import { toFtsQuery } from '../../core/search/fts-query.ts';
import type { HitKind, SearchHit } from '../../ports/store.ts';
import type { EngineDeps } from '../deps/engine-deps.types.ts';

export interface SearchResult {
  readonly hits: readonly SearchHit[];
  readonly loosened: boolean;
  readonly tracked: number;
}

export function searchLocal(
  deps: EngineDeps,
  input: {
    query: string;
    kinds: readonly HitKind[];
    within: string | null;
    limit: number;
    offset: number;
  },
): SearchResult {
  const strict = toFtsQuery(input.query, 'all');
  if (!strict)
    throw new ToolError(
      'The query has no words to search for.',
      'Example: "checkout shipping address".',
    );
  const run = (match: string, page: { limit: number; offset: number }) =>
    deps.stores.search.search({ ...input, ...page, match });
  const tracked = deps.stores.tracked.list().length;
  const page = { limit: input.limit + 1, offset: input.offset };
  /* The mode is decided by the first result alone, so every cursor page of one query uses the same mode. */
  if (run(strict, { limit: 1, offset: 0 }).length > 0)
    return { hits: run(strict, page), loosened: false, tracked };
  const loose = toFtsQuery(input.query, 'any');
  return { hits: loose && loose !== strict ? run(loose, page) : [], loosened: true, tracked };
}
