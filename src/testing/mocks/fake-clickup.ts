/**
 * A fake ClickUp API behind a fetch function: the same paths, query parameters and response shapes
 * the real API uses, served from FakeData. Tests change the data between calls, inject failures,
 * and read `calls` to prove what was (or was not) requested. Nothing here touches the network.
 */
import { type FakeData, sampleData, WORKSPACE } from '../fixtures/clickup-data.ts';

interface Failure {
  readonly match: RegExp;
  readonly status: number;
  /** How many requests fail before the route answers normally again. */
  times: number;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  /** Throw like a network failure instead of answering. */
  readonly network?: 'TypeError' | 'TimeoutError';
}

export interface FakeClickUp {
  readonly data: FakeData;
  readonly calls: string[];
  readonly headers: Headers[];
  readonly failures: Failure[];
  /** Tasks per page of GET /team/{id}/task (100 in ClickUp). */
  pageSize: number;
  fetch(url: string, init: RequestInit): Promise<Response>;
}

type Handler = (match: RegExpExecArray, url: URL, data: FakeData) => unknown;

const json = (body: unknown, status = 200): Response => Response.json(body, { status });
const v3 = `/api/v3/workspaces/${WORKSPACE}/docs`;
const num = (value: unknown): number => Number(value ?? 0);

type Raw = Record<string, unknown>;

function idOf(task: Raw, key: string): string {
  return String(Reflect.get(Object(task[key]), 'id') ?? '');
}

/** Empty filter matches everything. */
function within(allowed: readonly string[], value: string): boolean {
  return allowed.length === 0 || allowed.includes(value);
}

function inScope(task: Raw, q: URLSearchParams): boolean {
  const ids = (key: string) => q.getAll(`${key}[]`);
  const status = String(Reflect.get(Object(task['status']), 'status'));
  return (
    within(ids('list_ids'), idOf(task, 'list')) &&
    within(ids('project_ids'), idOf(task, 'folder')) &&
    within(ids('space_ids'), idOf(task, 'space')) &&
    within(ids('statuses'), status)
  );
}

function filterTasks(data: FakeData, url: URL): Raw[] {
  const q = url.searchParams;
  const after = num(q.get('date_updated_gt'));
  return data.tasks.filter((task) => {
    const closed = ['closed', 'done'].includes(String(Reflect.get(Object(task['status']), 'type')));
    const open = q.get('include_closed') === 'true' || !closed;
    return inScope(task, q) && open && num(task['date_updated']) > after;
  });
}

const hierarchyRoutes: [RegExp, Handler][] = [
  [/^\/api\/v2\/user$/, (_m, _u, d) => ({ user: d.user })],
  [
    /^\/api\/v2\/team$/,
    (_m, _u, d) => ({
      teams: [
        { id: WORKSPACE, members: d.members.map((user) => ({ user })) },
        { id: 1, members: [] },
      ],
    }),
  ],
  [/^\/api\/v2\/team\/\d+\/space$/, (_m, _u, d) => ({ spaces: d.spaces })],
  [/^\/api\/v2\/space\/(\w+)$/, (m, _u, d) => d.spaces.find((s) => s['id'] === m[1]) ?? null],
  [/^\/api\/v2\/space\/(\w+)\/folder$/, (m, _u, d) => ({ folders: d.folders[m[1] ?? ''] ?? [] })],
  [/^\/api\/v2\/space\/(\w+)\/list$/, (m, _u, d) => ({ lists: d.lists[m[1] ?? ''] ?? [] })],
  [
    /^\/api\/v2\/folder\/(\w+)$/,
    (m, _u, d) =>
      Object.values(d.folders)
        .flat()
        .find((f) => f['id'] === m[1]) ?? null,
  ],
  [
    /^\/api\/v2\/list\/(\w+)$/,
    (m, _u, d) =>
      [
        ...Object.values(d.lists).flat(),
        ...Object.values(d.folders)
          .flat()
          .flatMap((f) => (Array.isArray(f['lists']) ? f['lists'] : [])),
      ].find((l) => Object(l)['id'] === m[1]) ?? null,
  ],
];

const docRoutes: [RegExp, Handler][] = [
  [new RegExp(`^${v3}$`), (_m, u, d) => docPage(d, u)],
  [new RegExp(`^${v3}/([\\w-]+)$`), (m, _u, d) => d.docs.find((doc) => doc['id'] === m[1]) ?? null],
  [new RegExp(`^${v3}/([\\w-]+)/pages$`), (m, _u, d) => d.pages[m[1] ?? ''] ?? null],
];

function routes(fake: FakeClickUp): [RegExp, Handler][] {
  return [
    ...hierarchyRoutes,
    [
      /^\/api\/v2\/team\/\d+\/task$/,
      (_m, u, d) => taskPage(fake, filterTasks(d, u), num(u.searchParams.get('page'))),
    ],
    [
      /^\/api\/v2\/task\/(\w[\w-]*)$/,
      (m, _u, d) => d.tasks.find((t) => t['id'] === m[1] || t['custom_id'] === m[1]) ?? null,
    ],
    [
      /^\/api\/v2\/task\/(\w+)\/comment$/,
      (m, _u, d) => ({ comments: d.comments[m[1] ?? ''] ?? [] }),
    ],
    ...docRoutes,
  ];
}

function taskPage(fake: FakeClickUp, tasks: Record<string, unknown>[], page: number): unknown {
  const slice = tasks.slice(page * fake.pageSize, (page + 1) * fake.pageSize);
  return { tasks: slice, last_page: (page + 1) * fake.pageSize >= tasks.length };
}

function docPage(data: FakeData, url: URL): unknown {
  const parent = url.searchParams.get('parent_id');
  const docs = data.docs.filter(
    (doc) => !parent || Reflect.get(Object(doc['parent']), 'id') === parent,
  );
  const start = num(url.searchParams.get('cursor'));
  const next = start + 2 < docs.length ? String(start + 2) : null;
  return { docs: docs.slice(start, start + 2), next_cursor: next };
}

function failure(fake: FakeClickUp, url: string): Response | null {
  const hit = fake.failures.find((f) => f.times > 0 && f.match.test(url));
  if (!hit) return null;
  hit.times--;
  if (hit.network) {
    const error = new Error('fake network failure');
    error.name = hit.network;
    throw error;
  }
  return new Response(JSON.stringify(hit.body ?? { err: 'Injected failure', ECODE: 'FAKE_001' }), {
    status: hit.status,
    headers: hit.headers ?? {},
  });
}

function image(fake: FakeClickUp, url: string): Response {
  const bytes = fake.data.images[url];
  return bytes
    ? new Response(bytes, { headers: { 'content-type': 'image/png' } })
    : json({ err: 'gone' }, 404);
}

export function createFakeClickUp(data: FakeData = sampleData()): FakeClickUp {
  const fake: FakeClickUp = {
    data,
    calls: [],
    headers: [],
    failures: [],
    pageSize: 100,
    async fetch(url, init) {
      fake.calls.push(url);
      fake.headers.push(new Headers(init.headers));
      const injected = failure(fake, url);
      if (injected) return injected;
      const parsed = new URL(url);
      if (parsed.hostname !== 'api.clickup.com') return image(fake, url);
      for (const [pattern, handle] of routes(fake)) {
        const match = pattern.exec(parsed.pathname);
        if (!match) continue;
        const body = handle(match, parsed, fake.data);
        return body === null ? json({ err: 'Not found', ECODE: 'NOT_FOUND' }, 404) : json(body);
      }
      return json({ err: `No fake route for ${parsed.pathname}`, ECODE: 'FAKE_ROUTE' }, 404);
    },
  };
  return fake;
}
