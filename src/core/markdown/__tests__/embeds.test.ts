import { expect, test } from 'bun:test';
import { findEmbeds } from '../embeds.ts';

test('finds Figma, whiteboards, docs, tasks and videos, once each', () => {
  const md = [
    'Design https://www.figma.com/file/abc/Flow.',
    'Board https://app.clickup.com/9001/v/wb/abc-1',
    'Doc https://app.clickup.com/9001/v/dc/a-1 and https://doc.clickup.com/9001/d/h/a-1/x',
    'Task (https://app.clickup.com/t/86c1abcde)',
    'Video https://youtu.be/xyz https://www.loom.com/share/1',
    'Other https://example.com/x https://app.clickup.com/9001/home',
    'Again https://www.figma.com/file/abc/Flow',
    'Broken https://[::1',
  ].join('\n');
  expect(findEmbeds(md)).toEqual([
    { kind: 'figma', url: 'https://www.figma.com/file/abc/Flow' },
    { kind: 'whiteboard', url: 'https://app.clickup.com/9001/v/wb/abc-1' },
    { kind: 'clickup-doc', url: 'https://app.clickup.com/9001/v/dc/a-1' },
    { kind: 'clickup-doc', url: 'https://doc.clickup.com/9001/d/h/a-1/x' },
    { kind: 'clickup-task', url: 'https://app.clickup.com/t/86c1abcde' },
    { kind: 'video', url: 'https://youtu.be/xyz' },
    { kind: 'video', url: 'https://www.loom.com/share/1' },
  ]);
});
