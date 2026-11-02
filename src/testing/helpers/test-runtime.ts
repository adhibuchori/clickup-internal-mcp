/**
 * A full runtime for tests: real SQLite in a temporary folder, the fake ClickUp API, a frozen clock
 * the test moves by hand, an instant sleep, and captured logs. `call` goes through a real MCP client
 * and server over an in-memory transport, so a tool test passes only when Claude would get the same
 * answer.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { loadSqlite } from '../../adapters/store/sqlite.ts';
import {
  createRuntime,
  type Runtime,
  type RuntimeOptions,
} from '../../composition/create-runtime.ts';
import type { Settings } from '../../config/settings.ts';
import { buildMcpServer } from '../../tools/registry/build-server.ts';
import { createFakeClickUp, type FakeClickUp } from '../mocks/fake-clickup.ts';
import { T0, WORKSPACE } from '../fixtures/clickup-data.ts';

/** A fake token built at runtime, so no source line looks like a real one to a secret scanner. */
export const TEST_TOKEN = ['pk', '42', 'TESTTOKENTESTTOKENTESTTOKEN0000'].join('_');

interface ToolCall {
  readonly text: string;
  readonly isError: boolean;
  readonly image: { data: string; mimeType: string } | null;
}

export interface TestRuntime {
  readonly runtime: Runtime;
  readonly fake: FakeClickUp;
  readonly logs: string[];
  readonly dir: string;
  readonly clock: { now: number; advance(ms: number): void };
  call(name: string, args?: Record<string, unknown>): Promise<ToolCall>;
  close(): Promise<void>;
}

export function testSettings(dir: string, over: Partial<Settings> = {}): Settings {
  return {
    token: TEST_TOKEN,
    workspaceId: WORKSPACE,
    dataDir: join(dir, 'data'),
    mirrorDir: null,
    ttlDays: 30,
    maxConcurrency: 4,
    maxRpm: 1000,
    assetHosts: [],
    timeZone: 'Asia/Jakarta',
    logLevel: 'debug',
    ...over,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The text, error flag and first image of a tools/call result. */
function readResult(result: unknown): ToolCall {
  const content = isRecord(result) && Array.isArray(result['content']) ? result['content'] : [];
  const blocks: unknown[] = content;
  const text = blocks.find((b) => isRecord(b) && b['type'] === 'text');
  const image = blocks.find((b) => isRecord(b) && b['type'] === 'image');
  return {
    text: isRecord(text) && typeof text['text'] === 'string' ? text['text'] : '',
    isError: isRecord(result) && result['isError'] === true,
    image: isRecord(image)
      ? { data: String(image['data']), mimeType: String(image['mimeType']) }
      : null,
  };
}

export async function startTestRuntime(
  options: {
    settings?: Partial<Settings>;
    runtime?: Partial<RuntimeOptions>;
    fake?: FakeClickUp;
  } = {},
): Promise<TestRuntime> {
  const dir = mkdtempSync(join(tmpdir(), 'clickup-mcp-test-'));
  const fake = options.fake ?? createFakeClickUp();
  const logs: string[] = [];
  const clock = { now: T0, advance: (ms: number) => void (clock.now += ms) };
  const runtime = createRuntime({
    settings: testSettings(dir, options.settings),
    fetch: (url, init) => fake.fetch(url, init),
    openSqlite: await loadSqlite(),
    now: () => clock.now,
    sleep: async () => {},
    writeLog: (line) => logs.push(line),
    ...options.runtime,
  });
  const server = buildMcpServer(runtime.context, '0.0.0-test');
  const client = new Client({ name: 'test', version: '0' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return {
    runtime,
    fake,
    logs,
    dir,
    clock,
    call: async (name, args = {}) => readResult(await client.callTool({ name, arguments: args })),
    async close() {
      await client.close();
      await server.close();
      runtime.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
