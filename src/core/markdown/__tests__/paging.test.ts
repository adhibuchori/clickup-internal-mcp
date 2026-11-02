import { expect, test } from 'bun:test';
import { pageText } from '../paging.ts';

test('short text comes back whole', () => {
  expect(pageText('abc', 0, 10)).toEqual({ text: 'abc', next: null });
  expect(pageText('abc', 99, 10)).toEqual({ text: '', next: null });
});

test('cuts at a paragraph, then a line, then anywhere', () => {
  const paragraphs = `${'a'.repeat(30)}\n\n${'b'.repeat(30)}`;
  expect(pageText(paragraphs, 0, 40)).toEqual({ text: 'a'.repeat(30), next: 32 });
  expect(pageText(paragraphs, 32, 40)).toEqual({ text: 'b'.repeat(30), next: null });
  const lines = `${'a'.repeat(30)}\n${'b'.repeat(30)}`;
  expect(pageText(lines, 0, 40)).toEqual({ text: 'a'.repeat(30), next: 31 });
  expect(pageText('x'.repeat(100), 0, 40)).toEqual({ text: 'x'.repeat(40), next: 40 });
  expect(pageText('x'.repeat(100), -5, 200).next).toBeNull();
});
