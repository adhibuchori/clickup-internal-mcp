/**
 * The ClickUpReader port over the HTTP client: one method per endpoint, each response parsed with
 * its schema and mapped to the domain. Docs use API v3 (Markdown content), everything else v2.
 */
import type { z } from 'zod';
import { ApiError } from '../../core/errors/api-error.ts';
import type { ClickUpReader, TaskQuery } from '../../ports/clickup.ts';
import type { HttpClient, QueryValue } from './http-client.ts';
import { flattenPages, toComments, toDoc, toFolder, toList, toMember, toTask } from './mappers.ts';
import {
  commentsResponse,
  docSchema,
  docsResponse,
  folderSchema,
  foldersResponse,
  listSchema,
  listsResponse,
  pagesResponse,
  spaceSchema,
  spacesResponse,
  taskSchema,
  tasksResponse,
  teamsResponse,
  userResponse,
} from './schemas.ts';

export interface ReaderOptions {
  readonly http: HttpClient;
  readonly workspaceId: string;
  readonly timeZone: string;
}

interface Request<S extends z.ZodType> {
  readonly schema: S;
  readonly what: string;
  readonly path: string;
  readonly query?: Readonly<Record<string, QueryValue>>;
}

type Get = <S extends z.ZodType>(request: Request<S>) => Promise<z.output<S>>;

/** A response that does not have the documented shape is an API error, never a crash. */
function getter(http: HttpClient): Get {
  return async (request) => {
    const parsed = request.schema.safeParse(await http.getJson(request.path, request.query));
    if (parsed.success) return parsed.data;
    throw new ApiError(
      502,
      'UNEXPECTED_SHAPE',
      `ClickUp sent an unexpected ${request.what} response.`,
    );
  };
}

const enc = encodeURIComponent;
const ACTIVE = { archived: false };

function taskQuery(q: TaskQuery): Record<string, QueryValue> {
  return {
    page: q.page,
    list_ids: q.listIds,
    project_ids: q.folderIds,
    space_ids: q.spaceIds,
    statuses: q.statuses,
    assignees: q.assignees,
    tags: q.tags,
    include_closed: q.includeClosed,
    date_updated_gt: q.updatedAfter,
    due_date_lt: q.dueBefore,
    order_by: q.orderBy,
    subtasks: true,
    include_markdown_description: true,
  };
}

type Methods<K extends keyof ClickUpReader> = Pick<ClickUpReader, K>;

function spaceMethods(get: Get, ws: string): Methods<'spaces' | 'space' | 'folders'> {
  return {
    spaces: async () =>
      (
        await get({
          schema: spacesResponse,
          what: 'spaces',
          path: `/api/v2/team/${enc(ws)}/space`,
          query: ACTIVE,
        })
      ).spaces.map((s) => ({ id: s.id, name: s.name })),
    async space(id) {
      const space = await get({
        schema: spaceSchema,
        what: 'space',
        path: `/api/v2/space/${enc(id)}`,
      });
      return { id: space.id, name: space.name };
    },
    folders: async (spaceId) =>
      (
        await get({
          schema: foldersResponse,
          what: 'folders',
          path: `/api/v2/space/${enc(spaceId)}/folder`,
          query: ACTIVE,
        })
      ).folders.map(toFolder),
  };
}

function containerMethods(get: Get): Methods<'folder' | 'folderlessLists' | 'list'> {
  return {
    folder: async (id) =>
      toFolder(
        await get({ schema: folderSchema, what: 'folder', path: `/api/v2/folder/${enc(id)}` }),
      ),
    folderlessLists: async (spaceId) =>
      (
        await get({
          schema: listsResponse,
          what: 'lists',
          path: `/api/v2/space/${enc(spaceId)}/list`,
          query: ACTIVE,
        })
      ).lists.map(toList),
    list: async (id) =>
      toList(await get({ schema: listSchema, what: 'list', path: `/api/v2/list/${enc(id)}` })),
  };
}

function docs(get: Get, ws: string): Methods<'docs' | 'doc' | 'pages'> {
  const base = `/api/v3/workspaces/${enc(ws)}/docs`;
  return {
    async docs(query) {
      const body = await get({
        schema: docsResponse,
        what: 'docs',
        path: base,
        query: {
          parent_id: query.parentId,
          parent_type: query.parentType,
          cursor: query.cursor,
          limit: 100,
        },
      });
      return { docs: body.docs.map(toDoc), nextCursor: body.next_cursor || null };
    },
    doc: async (id) =>
      toDoc(await get({ schema: docSchema, what: 'doc', path: `${base}/${enc(id)}` })),
    pages: async (docId) =>
      flattenPages(
        docId,
        await get({
          schema: pagesResponse,
          what: 'pages',
          path: `${base}/${enc(docId)}/pages`,
          query: { max_page_depth: -1, content_format: 'text/md' },
        }),
      ),
  };
}

function tasks(get: Get, options: ReaderOptions): Methods<'task' | 'tasks' | 'comments'> {
  const { workspaceId, timeZone } = options;
  return {
    async task(id, custom) {
      const query = {
        include_markdown_description: true,
        include_subtasks: true,
        ...(custom ? { custom_task_ids: true, team_id: workspaceId } : {}),
      };
      return toTask(
        await get({ schema: taskSchema, what: 'task', path: `/api/v2/task/${enc(id)}`, query }),
        timeZone,
      );
    },
    async tasks(query) {
      const body = await get({
        schema: tasksResponse,
        what: 'tasks',
        path: `/api/v2/team/${enc(workspaceId)}/task`,
        query: taskQuery(query),
      });
      return {
        tasks: body.tasks.map((t) => toTask(t, timeZone)),
        lastPage: body.last_page ?? body.tasks.length < 100,
      };
    },
    comments: async (taskId) =>
      toComments(
        taskId,
        await get({
          schema: commentsResponse,
          what: 'comments',
          path: `/api/v2/task/${enc(taskId)}/comment`,
        }),
      ),
  };
}

export function createClickUpReader(options: ReaderOptions): ClickUpReader {
  const get = getter(options.http);
  return {
    me: async () =>
      toMember((await get({ schema: userResponse, what: 'user', path: '/api/v2/user' })).user),
    async members() {
      const { teams } = await get({ schema: teamsResponse, what: 'team', path: '/api/v2/team' });
      return (teams.find((t) => t.id === options.workspaceId)?.members ?? []).map((m) =>
        toMember(m.user),
      );
    },
    ...spaceMethods(get, options.workspaceId),
    ...containerMethods(get),
    ...docs(get, options.workspaceId),
    ...tasks(get, options),
    download: (url) => options.http.getBytes(url),
  };
}
