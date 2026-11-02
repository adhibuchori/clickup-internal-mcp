import { expect, test } from 'bun:test';
import { diffLines } from '../line-diff.ts';

test('identical text has no hunks', () => {
  expect(diffLines('a\nb', 'a\nb')).toEqual({ lines: [], added: 0, removed: 0 });
});

test('a change in the middle shows context and counts', () => {
  const before = ['1', '2', '3', '4', '5', '6', '7', '8'].join('\n');
  const after = ['1', '2', '3', 'four', '5', '6', '7', '8'].join('\n');
  expect(diffLines(before, after, 1)).toEqual({
    lines: ['  3', '- 4', '+ four', '  5'],
    added: 1,
    removed: 1,
  });
});

test('separate hunks are joined by an ellipsis', () => {
  const before = Array.from({ length: 12 }, (_, i) => `l${i}`).join('\n');
  const after = before.replace('l1\n', 'L1\n').replace('l10', 'L10');
  const result = diffLines(before, after, 1);
  expect(result.lines).toContain('…');
  expect(result.added).toBe(2);
});

test('pure additions and removals at either end', () => {
  expect(diffLines('a', 'a\nb').lines).toEqual(['  a', '+ b']);
  expect(diffLines('a\nb', 'b').lines).toEqual(['- a', '  b']);
  expect(diffLines('x\ny', 'p\nq')).toEqual({
    lines: ['- x', '- y', '+ p', '+ q'],
    added: 2,
    removed: 2,
  });
});

test('a middle too large for the table falls back to removed and added lines', () => {
  const before = Array.from({ length: 2100 }, (_, i) => `a${i}`).join('\n');
  const after = Array.from({ length: 2100 }, (_, i) => `b${i}`).join('\n');
  const result = diffLines(before, after, 0);
  expect(result.removed).toBe(2100);
  expect(result.added).toBe(2100);
  expect(result.lines[0]).toBe('- a0');
});
