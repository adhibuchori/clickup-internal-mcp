#!/usr/bin/env bun
/**
 * Phase 0 spike: checks the real API against the assumptions the server makes, printing only
 * SHAPES (keys and value types), counts and hosts, never content. Read-only: GET requests only.
 *
 *   bun run spike                       # user, spaces, team task paging, rate-limit headers
 *   bun run spike -- --doc <doc id>     # also: a doc's page tree shape and its image hosts
 *
 * Paste the output into docs/spike-notes.md after reading it yourself.
 */
import { extractImages } from '../../src/core/markdown/images.ts';
import { loadSettings } from '../../src/env.ts';

const settings = loadSettings();
const docArg = process.argv.indexOf('--doc');
const docId = docArg > 0 ? process.argv[docArg + 1] : undefined;

function shape(value: unknown, depth = 0): unknown {
  if (Array.isArray(value))
    return value.length === 0 ? '[]' : [shape(value[0], depth + 1), `…${value.length}`];
  if (value === null) return 'null';
  if (typeof value !== 'object') return typeof value;
  if (depth > 3) return '{…}';
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v, depth + 1)]));
}

async function get(path: string): Promise<{ body: unknown; headers: Headers; status: number }> {
  const response = await fetch(`https://api.clickup.com${path}`, {
    headers: { authorization: settings.token },
  });
  if (response.status === 401) {
    console.error('The token was rejected. Stopping.');
    process.exit(1);
  }
  return { body: await response.json(), headers: response.headers, status: response.status };
}

const ws = settings.workspaceId;
const user = await get('/api/v2/user');
console.log('user:', JSON.stringify(shape(user.body)));
console.log(
  'rate limit headers:',
  ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']
    .map((h) => `${h}=${user.headers.get(h) ?? 'absent'}`)
    .join(' '),
);
const spaces = await get(`/api/v2/team/${ws}/space?archived=false`);
console.log('spaces:', spaces.status, JSON.stringify(shape(spaces.body)));
const tasks = await get(
  `/api/v2/team/${ws}/task?page=0&include_markdown_description=true&subtasks=true`,
);
const taskBody = Object(tasks.body);
console.log(
  'team tasks:',
  tasks.status,
  'top-level keys:',
  Object.keys(taskBody).join(', '),
  'last_page:',
  typeof taskBody.last_page,
);
console.log(
  'task shape:',
  JSON.stringify(shape(Array.isArray(taskBody.tasks) ? taskBody.tasks[0] : null)),
);
if (docId) {
  const pages = await get(
    `/api/v3/workspaces/${ws}/docs/${encodeURIComponent(docId)}/pages?max_page_depth=-1&content_format=text%2Fmd`,
  );
  console.log('pages:', pages.status, JSON.stringify(shape(pages.body)));
  const flat: string[] = [];
  const walk = (list: unknown): void => {
    for (const page of Array.isArray(list) ? list : []) {
      flat.push(String(Object(page).content ?? ''));
      walk(Object(page).pages);
    }
  };
  walk(pages.body);
  const hosts = new Set(
    flat.flatMap((md) => extractImages(md).map((i) => new URL(i.url, 'https://invalid').hostname)),
  );
  console.log(`pages: ${flat.length}, image hosts: ${[...hosts].join(', ') || 'none'}`);
}
