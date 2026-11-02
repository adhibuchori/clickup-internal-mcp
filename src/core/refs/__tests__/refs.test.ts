import { describe, expect, test } from 'bun:test';
import { ToolError } from '../../errors/tool-error.ts';
import { formatRef, parseRef, requireRef } from '../refs.ts';

describe('parseRef', () => {
  test('prefixed references', () => {
    expect(parseRef('task:86c1abcde')).toEqual({ kind: 'task', id: '86c1abcde', custom: false });
    expect(parseRef('task:MOB-12')).toEqual({ kind: 'task', id: 'MOB-12', custom: true });
    expect(parseRef('doc:8cdu22c-1')).toEqual({ kind: 'doc', docId: '8cdu22c-1', pageId: null });
    expect(parseRef('doc:8cdu22c-1/page:8cdu22c-2')).toEqual({
      kind: 'doc',
      docId: '8cdu22c-1',
      pageId: '8cdu22c-2',
    });
    expect(parseRef('list:300')).toEqual({ kind: 'list', id: '300' });
    expect(parseRef('folder:200')).toEqual({ kind: 'folder', id: '200' });
    expect(parseRef(' space:100 ')).toEqual({ kind: 'space', id: '100' });
    expect(parseRef('img:3f2a9c1b7d4e')).toEqual({ kind: 'image', sha: '3f2a9c1b7d4e' });
    expect(parseRef('img:not-hex')).toBeNull();
    expect(parseRef('user:5')).toBeNull();
  });

  test('ClickUp URLs on any clickup.com host', () => {
    expect(parseRef('https://app.clickup.com/t/86c1abcde')).toEqual({
      kind: 'task',
      id: '86c1abcde',
      custom: false,
    });
    expect(parseRef('https://acme.clickup.com/t/9001/MOB-7')).toEqual({
      kind: 'task',
      id: 'MOB-7',
      custom: true,
    });
    expect(parseRef('https://app.clickup.com/9001/v/dc/8cdu22c-1/8cdu22c-2?block=x')).toEqual({
      kind: 'doc',
      docId: '8cdu22c-1',
      pageId: '8cdu22c-2',
    });
    expect(parseRef('https://app.clickup.com/9001/v/dc/8cdu22c-1')).toEqual({
      kind: 'doc',
      docId: '8cdu22c-1',
      pageId: null,
    });
    expect(parseRef('https://doc.clickup.com/9001/d/h/8cdu22c-1/abcdef/8cdu22c-2')).toEqual({
      kind: 'doc',
      docId: '8cdu22c-1',
      pageId: '8cdu22c-2',
    });
    expect(parseRef('https://app.clickup.com/9001/v/li/300')).toEqual({ kind: 'list', id: '300' });
    expect(parseRef('https://app.clickup.com/9001/v/f/200')).toEqual({ kind: 'folder', id: '200' });
    expect(parseRef('https://app.clickup.com/9001/v/s/100')).toEqual({ kind: 'space', id: '100' });
    expect(parseRef('https://app.clickup.com/9001/v/l/6-300-1')).toEqual({
      kind: 'list',
      id: '300',
    });
    expect(parseRef('https://app.clickup.com/9001/v/b/5-200-1')).toEqual({
      kind: 'folder',
      id: '200',
    });
    expect(parseRef('https://app.clickup.com/9001/v/l/8-300-1')).toBeNull();
    expect(parseRef('https://app.clickup.com/9001/home')).toBeNull();
    expect(parseRef('https://app.clickup.com/9001/v/dc')).toBeNull();
    expect(parseRef('https://app.clickup.com/t/')).toBeNull();
    expect(parseRef('https://clickup.com/t/86c1abcde')).toEqual({
      kind: 'task',
      id: '86c1abcde',
      custom: false,
    });
  });

  test('foreign hosts, broken URLs and bare ids', () => {
    expect(parseRef('https://evil.example.com/t/86c1abcde')).toBeNull();
    expect(parseRef('https://notclickup.com/t/86c1abcde')).toBeNull();
    expect(parseRef('https://')).toBeNull();
    expect(parseRef('#86c1abcde')).toEqual({ kind: 'task', id: '86c1abcde', custom: false });
    expect(parseRef('MOB-1')).toEqual({ kind: 'task', id: 'MOB-1', custom: true });
    expect(parseRef('8cdu22c-13133')).toEqual({
      kind: 'doc',
      docId: '8cdu22c-13133',
      pageId: null,
    });
    expect(parseRef('300')).toBeNull();
    expect(parseRef('')).toBeNull();
    expect(parseRef('x'.repeat(3000))).toBeNull();
  });
});

describe('requireRef', () => {
  test('returns the reference when its kind is accepted', () => {
    const ref: unknown = requireRef('list:1', ['list', 'space']);
    expect(ref).toEqual({ kind: 'list', id: '1' });
  });

  test('explains what is accepted, and flags a bare number', () => {
    expect(() => requireRef('task:abcdef1', ['doc'])).toThrow(ToolError);
    try {
      requireRef('300', ['list', 'image']);
    } catch (error) {
      expect(error).toBeInstanceOf(ToolError);
      const e = error instanceof ToolError ? error : new ToolError('');
      expect(e.message).toContain('A bare number is ambiguous');
      expect(e.hint).toContain('list:901812345678');
      expect(e.hint).toContain('img:');
    }
  });
});

test('formatRef prints every kind as parseRef reads it back', () => {
  const refs = [
    'task:86c1abcde',
    'doc:a1-1',
    'doc:a1-1/page:a1-2',
    'list:3',
    'folder:2',
    'space:1',
  ];
  for (const text of refs) {
    const ref = parseRef(text);
    expect(ref && formatRef(ref)).toBe(text);
  }
  expect(formatRef({ kind: 'image', sha: 'a'.repeat(64) })).toBe(`img:${'a'.repeat(12)}`);
});
