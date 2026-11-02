import { expect, test } from 'bun:test';
import { createLimiter } from '../limiter.ts';

test('never runs more than `concurrency` tasks at once', async () => {
  const limiter = createLimiter({
    concurrency: 2,
    perMinute: 100,
    now: () => 0,
    sleep: async () => {},
  });
  let active = 0;
  let peak = 0;
  const task = async (): Promise<number> => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    return 1;
  };
  const results = await Promise.all(Array.from({ length: 6 }, () => limiter.run(task)));
  expect(results).toEqual([1, 1, 1, 1, 1, 1]);
  expect(peak).toBe(2);
});

test('waits for the rolling minute when the per-minute budget is spent', async () => {
  let now = 1_000;
  const waits: number[] = [];
  const limiter = createLimiter({
    concurrency: 5,
    perMinute: 2,
    now: () => now,
    sleep: async (ms) => {
      waits.push(ms);
      now += ms;
    },
  });
  for (let i = 0; i < 3; i++) await limiter.run(async () => i);
  expect(waits).toEqual([60_000]);
});

test('a failing task releases its slot', async () => {
  const limiter = createLimiter({
    concurrency: 1,
    perMinute: 10,
    now: () => 0,
    sleep: async () => {},
  });
  expect(
    await limiter.run(() => Promise.reject(new Error('boom'))).catch((error: unknown) => error),
  ).toMatchObject({ message: 'boom' });
  expect(await limiter.run(async () => 'next')).toBe('next');
});
