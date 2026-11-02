import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSqlite } from '../../adapters/store/sqlite.ts';
import { testSettings } from '../../testing/helpers/test-runtime.ts';
import { createRuntime } from '../create-runtime.ts';

const dir = mkdtempSync(join(tmpdir(), 'runtime-'));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test('defaults: real timers, the system clock and a 40k character budget', async () => {
  const runtime = createRuntime({
    settings: testSettings(dir, { mirrorDir: join(dir, 'mirror') }),
    fetch: async () => Response.json({}),
    openSqlite: await loadSqlite(),
    writeLog: () => {},
  });
  expect(runtime.context.budget).toBe(40_000);
  expect(runtime.deps.config.syncWaitMs).toBe(45_000);
  expect(runtime.deps.mirror).not.toBeNull();
  expect(Math.abs(runtime.deps.clock.now() - Date.now())).toBeLessThan(1000);
  const started = Date.now();
  await runtime.deps.sleep(5);
  await runtime.deps.wait(5);
  expect(Date.now() - started).toBeGreaterThanOrEqual(8);
  runtime.close();
});
