import { afterEach, beforeEach, expect, test } from 'bun:test';
import { startTestRuntime, type TestRuntime } from '../../../testing/helpers/test-runtime.ts';

let t: TestRuntime;
beforeEach(async () => {
  t = await startTestRuntime();
});
afterEach(async () => {
  await t.close();
});

test('with nothing tracked it says how to start', async () => {
  const { text } = await t.call('search', { query: 'limit' });
  expect(text).toContain('Nothing is tracked yet');
});

test('finds pages, tasks and comments by word prefix, titles first', async () => {
  await t.call('track', { action: 'add', target: 'list:300' });
  const { text } = await t.call('search', { query: 'disetuj' });
  expect(text).toContain('1. task:86c1abcde · comment on · Checkout pesanan (comment by bob)');
  expect(text).toContain('Batas sudah «disetujui»');
  const limit = await t.call('search', { query: 'maksimal barang', kinds: ['docs'] });
  expect(limit.text).toContain(
    'doc:8cdu22c-13133/page:8cdu22c-4322 · doc page · Checkout Requirements › Limits',
  );
  const tasks = await t.call('search', { query: 'MOB', kinds: ['tasks'] });
  expect(tasks.text).toContain('task:86c1abcde · task · MOB-1 Checkout pesanan');
});

test('narrows to a doc or a scope, loosens to any word, and pages with a cursor', async () => {
  await t.call('track', { action: 'add', target: 'space:100' });
  const inDoc = await t.call('search', {
    query: 'pelanggan',
    in: 'https://app.clickup.com/9001/v/dc/8cdu22c-13133',
  });
  expect(inDoc.text).toContain('doc:8cdu22c-13133/page:');
  expect(inDoc.text).not.toContain('task:');
  const inList = await t.call('search', { query: 'backlog', in: 'list:301' });
  expect(inList.text).toContain('No tracked content matches');
  const inSpace = await t.call('search', { query: 'backlog', in: 'space:100' });
  expect(inSpace.text).toContain('task:86c1fghij');
  const loose = await t.call('search', { query: 'pelanggan zzzzz' });
  expect(loose.text).toContain('No result has every word; showing results with any of them.');
  const first = await t.call('search', { query: 'pelanggan zzzzz', limit: 1 });
  const cursor = /cursor "([^"]+)"/.exec(first.text)?.[1];
  expect(cursor).toBeDefined();
  const next = await t.call('search', { query: 'pelanggan zzzzz', limit: 1, cursor });
  expect(next.text).toContain('2. ');
  expect((await t.call('search', { query: 'qqqq' })).text).toContain(
    'No tracked content matches "qqqq"',
  );
  expect((await t.call('search', { query: 'toko', in: 'task:86c1abcde' })).text).toContain(
    'No tracked content',
  );
});

test('a query without words is refused', async () => {
  await t.call('track', { action: 'add', target: 'doc:8cdu22c-200' });
  const { isError, text } = await t.call('search', { query: '!!!' });
  expect(isError).toBe(true);
  expect(text).toContain('no words');
});
