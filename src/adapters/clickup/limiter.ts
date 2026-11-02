/**
 * Traffic shaping toward ClickUp: at most `concurrency` requests in flight and at most `perMinute`
 * started in any rolling minute. Far below the plan's limit on purpose: a company network's monitoring should
 * see a person reading, not a crawler. Time and sleeping are injected so tests run instantly.
 */
export interface Limiter {
  run<T>(task: () => Promise<T>): Promise<T>;
}

export interface LimiterOptions {
  readonly concurrency: number;
  readonly perMinute: number;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
}

const MINUTE = 60_000;

export function createLimiter(options: LimiterOptions): Limiter {
  const started: number[] = [];
  const waiting: (() => void)[] = [];
  let active = 0;

  const acquireSlot = async (): Promise<void> => {
    if (active < options.concurrency) {
      active++;
      return;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  };
  const releaseSlot = (): void => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };
  const awaitBudget = async (): Promise<void> => {
    const now = options.now();
    while (started.length > 0 && (started[0] ?? 0) <= now - MINUTE) started.shift();
    if (started.length < options.perMinute) {
      started.push(now);
      return;
    }
    await options.sleep((started[0] ?? now) + MINUTE - now);
    await awaitBudget();
  };

  return {
    async run(task) {
      await acquireSlot();
      try {
        await awaitBudget();
        return await task();
      } finally {
        releaseSlot();
      }
    },
  };
}
