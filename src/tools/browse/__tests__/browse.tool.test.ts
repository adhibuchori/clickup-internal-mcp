import { afterEach, beforeEach, expect, test } from 'bun:test';
import { startTestRuntime, type TestRuntime } from '../../../testing/helpers/test-runtime.ts';

let t: TestRuntime;
beforeEach(async () => {
  t = await startTestRuntime();
});
afterEach(async () => {
  await t.close();
});

test('without a target it lists the spaces', async () => {
  const result = await t.call('browse');
  expect(result.isError).toBe(false);
  expect(result.text).toContain('space:100  Online Store');
});

test('a space shows folders with their lists, folderless lists and docs', async () => {
  const { text } = await t.call('browse', { target: 'space:100' });
  expect(text).toContain('folder:200  Mobile App (1 list)');
  expect(text).toContain('    list:300  Sprint 42 (1 task)');
  expect(text).toContain('Lists outside folders:');
  expect(text).toContain('  list:301  Backlog (1 task)');
  expect(text).toContain('doc:8cdu22c-200  Space Handbook');
});

test('a folder and a list show their content, and URLs work as targets', async () => {
  const folder = await t.call('browse', { target: 'https://acme.clickup.com/9001/v/f/200' });
  expect(folder.text).toContain('Folder: Mobile App (folder:200) in space:100');
  expect(folder.text).toContain('doc:8cdu22c-300  Folder Notes');
  const list = await t.call('browse', { target: 'https://app.clickup.com/9001/v/li/300' });
  expect(list.text).toContain('List: Sprint 42 (list:300) in folder Mobile App, space:100');
  expect(list.text).toContain('doc:8cdu22c-13133  Checkout Requirements · updated 5h ago');
  expect(list.text).toContain('list_tasks with in "list:300"');
});

test('answers are remembered for ten minutes unless fresh is asked', async () => {
  await t.call('browse');
  const before = t.fake.calls.length;
  await t.call('browse');
  expect(t.fake.calls.length).toBe(before);
  await t.call('browse', { fresh: true });
  expect(t.fake.calls.length).toBe(before + 1);
});

test('a space with nothing visible and a wrong kind of target', async () => {
  t.fake.data.spaces = [];
  expect((await t.call('browse')).text).toContain('no spaces');
  const wrong = await t.call('browse', { target: 'task:86c1abcde' });
  expect(wrong.isError).toBe(true);
  expect(wrong.text).toContain('not a reference this tool accepts');
});

test('an empty space, and docs that span several cursor pages', async () => {
  t.fake.data.folders['100'] = [];
  t.fake.data.lists['100'] = [];
  for (let i = 0; i < 5; i++)
    t.fake.data.docs.push({
      id: `8cdu22c-90${i}`,
      name: `Extra ${i}`,
      creator: 1,
      parent: { id: '100', type: 4 },
    });
  const { text } = await t.call('browse', { target: 'space:100' });
  expect(text).not.toContain('Folders:');
  expect(text).not.toContain('Lists outside folders:');
  expect(text).toContain('Docs (6):');
  expect(text).toContain('doc:8cdu22c-904  Extra 4');
});
