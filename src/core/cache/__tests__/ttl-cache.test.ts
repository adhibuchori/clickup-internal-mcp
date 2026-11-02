import { expect, test } from 'bun:test';
import { createTtlCache } from '../ttl-cache.ts';

test('entries expire, the least recently used goes first, and clear empties it', () => {
  let now = 0;
  const cache = createTtlCache<number>({ ttlMs: 100, max: 2, now: () => now });
  cache.set('a', 1);
  cache.set('b', 2);
  expect(cache.get('a')).toBe(1);
  cache.set('c', 3);
  expect(cache.get('b')).toBeUndefined();
  expect(cache.get('a')).toBe(1);
  now = 200;
  expect(cache.get('a')).toBeUndefined();
  expect(cache.get('missing')).toBeUndefined();
  cache.set('d', 4);
  cache.clear();
  expect(cache.get('d')).toBeUndefined();
});
