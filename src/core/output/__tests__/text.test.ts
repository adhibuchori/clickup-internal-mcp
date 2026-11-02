import { expect, test } from 'bun:test';
import { ago, clip, formatDate, formatDateTime, plural } from '../text.ts';

test('plural', () => {
  expect(plural(1, 'task')).toBe('1 task');
  expect(plural(2, 'match')).toBe('2 matches');
  expect(plural(1200, 'page')).toBe('1,200 pages');
});

test('dates are rendered in the zone, not in UTC', () => {
  const midnightJakarta = Date.UTC(2026, 10, 1, 17, 0);
  expect(formatDate(midnightJakarta, 'Asia/Jakarta')).toBe('2026-11-02');
  expect(formatDate(midnightJakarta, 'UTC')).toBe('2026-11-01');
  expect(formatDateTime(midnightJakarta, 'Asia/Jakarta')).toBe('2026-11-02 00:00');
});

test('ago covers the past, the future and the immediate', () => {
  const now = Date.UTC(2026, 0, 10);
  expect(ago(now - 30_000, now)).toBe('just now');
  expect(ago(now - 5 * 60_000, now)).toBe('5m ago');
  expect(ago(now - 3 * 86_400_000, now)).toBe('3d ago');
  expect(ago(now - 400 * 86_400_000, now)).toBe('1y ago');
  expect(ago(now + 2 * 86_400_000, now)).toBe('in 2d');
});

test('clip collapses whitespace and cuts with an ellipsis', () => {
  expect(clip('  a \n b  ', 10)).toBe('a b');
  expect(clip('abcdefghij', 5)).toBe('abcd…');
});
