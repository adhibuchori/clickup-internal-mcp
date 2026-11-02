import { expect, test } from 'bun:test';
import { toFtsQuery } from '../fts-query.ts';

test('words become quoted prefix terms; short words stay exact', () => {
  expect(toFtsQuery('limit checkout', 'all')).toBe('"limit"* "checkout"*');
  expect(toFtsQuery('ok go', 'any')).toBe('"ok" OR "go"');
});

test('phrases stay phrases and operators are neutralised', () => {
  expect(toFtsQuery('"daily limit" NEAR(x) OR -y', 'all')).toBe(
    '"daily limit" "NEAR"* "x" "OR" "y"',
  );
  expect(toFtsQuery('pembayaran pelanggan"', 'all')).toBe('"pembayaran"* "pelanggan"*');
  expect(toFtsQuery('""', 'all')).toBeNull();
  expect(toFtsQuery('*** ---', 'all')).toBeNull();
});

test('at most sixteen terms', () => {
  const many = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');
  expect(toFtsQuery(many, 'all')?.split(' ').length).toBe(16);
});
