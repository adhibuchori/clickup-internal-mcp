import { expect, test } from 'bun:test';
import { ToolError } from '../../errors/tool-error.ts';
import { parseWhen, startOfDay } from '../when.ts';

const NOW = Date.UTC(2026, 10, 2, 12, 0);

test('relative times count back from now', () => {
  expect(parseWhen('7d', NOW, 'UTC')).toBe(NOW - 7 * 86_400_000);
  expect(parseWhen(' 24H ', NOW, 'UTC')).toBe(NOW - 24 * 3_600_000);
  expect(parseWhen('2w', NOW, 'UTC')).toBe(NOW - 14 * 86_400_000);
  expect(parseWhen('30m', NOW, 'UTC')).toBe(NOW - 30 * 60_000);
});

test('a date is the start of that day in the zone', () => {
  expect(parseWhen('2026-11-01', NOW, 'Asia/Jakarta')).toBe(Date.UTC(2026, 9, 31, 17, 0));
  expect(parseWhen('2026-11-01', NOW, 'UTC')).toBe(Date.UTC(2026, 10, 1));
  expect(startOfDay({ year: 2026, month: 3, day: 9 }, 'America/New_York')).toBe(
    Date.UTC(2026, 2, 9, 4, 0),
  );
});

test('anything else is a ToolError with examples', () => {
  for (const bad of ['yesterday', '2026-13-01', '2026-02-00', '5y'])
    expect(() => parseWhen(bad, NOW, 'UTC')).toThrow(ToolError);
});
