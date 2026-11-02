import { expect, test } from 'bun:test';
import { z } from 'zod';
import { int, intOrNull, parseJson, text, textOrNull } from '../rows.ts';

test('typed reads accept what SQLite returns and default the rest', () => {
  const row = { s: 'a', n: 5, b: 7n, e: '', z: null, o: { x: 1 } };
  expect([
    text(row, 's'),
    text(row, 'n'),
    text(row, 'b'),
    text(row, 'o'),
    text(undefined, 's'),
  ]).toEqual(['a', '5', '7', '', '']);
  expect([
    int(row, 'n'),
    int(row, 'b'),
    int({ v: '12' }, 'v'),
    int(row, 'e'),
    int(row, 'o'),
  ]).toEqual([5, 7, 12, 0, 0]);
  expect([intOrNull(row, 'z'), intOrNull(row, 'missing'), intOrNull(row, 'n')]).toEqual([
    null,
    null,
    5,
  ]);
  expect([textOrNull(row, 'z'), textOrNull(row, 's')]).toEqual([null, 'a']);
});

test('parseJson returns null for broken JSON or a shape that no longer fits', () => {
  const schema = z.object({ a: z.number() });
  expect(parseJson(schema, '{"a":1}')).toEqual({ a: 1 });
  expect(parseJson(schema, '{"a":"x"}')).toBeNull();
  expect(parseJson(schema, '{')).toBeNull();
});
