import { afterEach, beforeEach, expect, test } from 'bun:test';
import {
  startTestRuntime,
  TEST_TOKEN,
  type TestRuntime,
} from '../../../testing/helpers/test-runtime.ts';
import { rawTask } from '../../../testing/fixtures/clickup-data.ts';

let t: TestRuntime;
beforeEach(async () => {
  t = await startTestRuntime();
});
afterEach(async () => {
  await t.close();
});

test('every tool is listed with annotations and server instructions', async () => {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
  const { buildMcpServer } = await import('../build-server.ts');
  const server = buildMcpServer(t.runtime.context, '1.0.0');
  const client = new Client({ name: 'list', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name)).toEqual([
    'browse',
    'read_doc',
    'read_task',
    'list_tasks',
    'search',
    'track',
    'changes',
    'view_image',
    'note_image',
  ]);
  for (const tool of tools) expect((tool.description ?? '').length).toBeLessThan(2048);
  expect(tools.find((tool) => tool.name === 'read_doc')?.annotations).toMatchObject({
    readOnlyHint: true,
    openWorldHint: true,
  });
  expect(tools.find((tool) => tool.name === 'track')?.annotations).toMatchObject({
    readOnlyHint: false,
    destructiveHint: true,
  });
  const instructions = client.getInstructions() ?? '';
  expect(instructions).toContain('0 scopes tracked now');
  expect(instructions.length).toBeLessThan(2048);
  await client.close();
  await server.close();
});

test('answers are redacted, including ClickUp tokens pasted into content', async () => {
  t.fake.data.tasks[0] = rawTask({ markdown_description: `token: ${TEST_TOKEN}` });
  const { text } = await t.call('read_task', { task: 'task:86c1abcde', comments: false });
  expect(text).not.toContain(TEST_TOKEN);
  expect(text).toContain('[REDACTED]');
});

test('an unexpected failure is generic for the model and logged with its stack', async () => {
  t.runtime.deps.stores.close();
  const { isError, text } = await t.call('track', { action: 'list' });
  expect(isError).toBe(true);
  expect(text).toBe(
    'Error: Internal error while running the tool. The server log has the details.',
  );
  expect(t.logs.some((l) => l.includes('tool failed'))).toBe(true);
});

test('an unexpected ClickUp response shape is reported, not crashed on', async () => {
  t.fake.data.spaces = [{ id: { nested: true } }];
  const { text } = await t.call('browse', { fresh: true });
  expect(text).toContain('ClickUp could not return the spaces (502 UNEXPECTED_SHAPE)');
});
