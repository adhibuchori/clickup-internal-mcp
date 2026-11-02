#!/usr/bin/env node
/**
 * CI smoke test: starts the server the way an MCP client does (a child process speaking JSON-RPC
 * over stdio) and checks what a client sees, without any network: the server info, the nine tools,
 * and two tool calls that only touch the local cache. Runs under Node or Bun.
 *
 *   node scripts/ci/mcp-smoke.ts <command> [args...]
 *
 * The caller provides settings (a fake token and a temporary CLICKUP_DATA_DIR) through the
 * environment or a settings file beside an executable.
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: mcp-smoke.ts <command> [args...]');
  process.exit(2);
}

const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] });
const answers = new Map<number, unknown>();
const waiting = new Map<number, (value: unknown) => void>();
createInterface({ input: child.stdout }).on('line', (line) => {
  const message: unknown = JSON.parse(line);
  const id = Number(Reflect.get(Object(message), 'id'));
  answers.set(id, message);
  waiting.get(id)?.(message);
});

function send(message: Record<string, unknown>): void {
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
}

function request(id: number, method: string, params: Record<string, unknown>): Promise<unknown> {
  send({ id, method, params });
  return new Promise((resolve) =>
    answers.has(id) ? resolve(answers.get(id)) : waiting.set(id, resolve),
  );
}

function text(answer: unknown): string {
  const content: unknown = Reflect.get(Object(Reflect.get(Object(answer), 'result')), 'content');
  return Array.isArray(content)
    ? String(Reflect.get(Object(content[0]), 'text'))
    : JSON.stringify(answer);
}

function check(ok: boolean, label: string, detail: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}: ${detail}`);
  if (!ok) process.exitCode = 1;
}

const timer = setTimeout(() => {
  console.error('FAIL  the server did not answer within 30 s');
  process.exit(1);
}, 30_000);

const init = await request(1, 'initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'ci-smoke', version: '0' },
});
const info = Reflect.get(Object(Reflect.get(Object(init), 'result')), 'serverInfo');
check(
  Reflect.get(Object(info), 'name') === 'clickup-internal-mcp',
  'serverInfo',
  JSON.stringify(info),
);
send({ method: 'notifications/initialized' });
const listed: unknown = Reflect.get(
  Object(Reflect.get(Object(await request(2, 'tools/list', {})), 'result')),
  'tools',
);
const names = Array.isArray(listed)
  ? listed.map((tool) => String(Reflect.get(Object(tool), 'name')))
  : [];
check(names.length === 9, 'tools', names.join(', '));
const tracked = text(
  await request(3, 'tools/call', { name: 'track', arguments: { action: 'list' } }),
);
check(tracked.startsWith('Nothing is tracked'), 'track list', tracked.split('\n')[0] ?? '');
const searched = text(
  await request(4, 'tools/call', { name: 'search', arguments: { query: 'limit' } }),
);
check(searched.startsWith('Nothing is tracked yet'), 'search', searched.split('\n')[0] ?? '');
clearTimeout(timer);
child.stdin.end();
child.kill();
