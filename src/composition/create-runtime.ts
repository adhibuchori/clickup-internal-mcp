/**
 * Wires the server: settings → logger, limiter, HTTP client, ClickUp reader, SQLite stores, files,
 * memo caches → EngineDeps → ToolContext. Tests call it with a fake fetch, a temporary data folder
 * and an instant sleep; the CLI calls it with the real ones.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClickUpReader } from '../adapters/clickup/clickup-reader.ts';
import { createHttpClient, type FetchLike } from '../adapters/clickup/http-client.ts';
import { createLimiter } from '../adapters/clickup/limiter.ts';
import { createAssetFiles } from '../adapters/files/asset-files.ts';
import { createMirrorFiles } from '../adapters/files/mirror-files.ts';
import { createConsoleLogger } from '../adapters/logger/console-logger.ts';
import { createStores } from '../adapters/store/open-store.ts';
import type { OpenSqlite } from '../adapters/store/sqlite.ts';
import type { Settings } from '../config/settings.ts';
import { createTtlCache } from '../core/cache/ttl-cache.ts';
import type { EngineConfig, EngineDeps, Memo } from '../engine/deps/engine-deps.types.ts';
import type { ClickUpReader } from '../ports/clickup.ts';
import type { Logger } from '../ports/runtime.ts';
import { prune } from '../engine/sync/tracking.ts';
import type { ToolContext } from '../tools/registry/define-tool.ts';

export interface RuntimeOptions {
  readonly settings: Settings;
  readonly fetch: FetchLike;
  readonly openSqlite: OpenSqlite;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  /** What `track` waits on (default: a real timer). */
  readonly wait?: (ms: number) => Promise<void>;
  readonly writeLog?: (line: string) => void;
  /** Character budget of one answer (default 40,000, about 10k tokens). */
  readonly budget?: number;
  /** How long `track` waits for a first sync (default 45 s). */
  readonly syncWaitMs?: number;
}

export interface Runtime {
  readonly deps: EngineDeps;
  readonly context: ToolContext;
  close(): void;
}

const MINUTE = 60_000;

interface Basics {
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly logger: Logger;
}

function clickupReader(options: RuntimeOptions, basics: Basics): ClickUpReader {
  const { settings } = options;
  const limiter = createLimiter({
    concurrency: settings.maxConcurrency,
    perMinute: settings.maxRpm,
    now: basics.now,
    sleep: basics.sleep,
  });
  const http = createHttpClient({
    ...basics,
    token: settings.token,
    fetch: options.fetch,
    limiter,
    timeoutMs: 20_000,
    retries: 3,
    assetHosts: settings.assetHosts,
    maxDownloadBytes: 25 * 1024 * 1024,
  });
  return createClickUpReader({
    http,
    workspaceId: settings.workspaceId,
    timeZone: settings.timeZone,
  });
}

function engineConfig(options: RuntimeOptions): EngineConfig {
  const { settings } = options;
  return {
    workspaceId: settings.workspaceId,
    timeZone: settings.timeZone,
    assetHosts: settings.assetHosts,
    maxViewBytes: 5 * 1024 * 1024,
    staleMs: 30 * MINUTE,
    ttlDays: settings.ttlDays,
    syncWaitMs: options.syncWaitMs ?? 45_000,
  };
}

function memo(now: () => number): Memo {
  return {
    docs: createTtlCache({ ttlMs: 5 * MINUTE, max: 50, now }),
    tasks: createTtlCache({ ttlMs: MINUTE, max: 200, now }),
    text: createTtlCache({ ttlMs: 10 * MINUTE, max: 100, now }),
    me: createTtlCache({ ttlMs: 60 * MINUTE, max: 1, now }),
  };
}

const realSleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createRuntime(options: RuntimeOptions): Runtime {
  const { settings } = options;
  const now = options.now ?? Date.now;
  const basics: Basics = {
    now,
    sleep: options.sleep ?? realSleep,
    logger: createConsoleLogger(settings.logLevel, options.writeLog),
  };
  mkdirSync(settings.dataDir, { recursive: true, mode: 0o700 });
  const stores = createStores(
    options.openSqlite(join(settings.dataDir, 'store.db'), { readonly: false }),
  );
  const deps: EngineDeps = {
    clickup: clickupReader(options, basics),
    stores,
    assets: createAssetFiles(join(settings.dataDir, 'assets')),
    mirror: settings.mirrorDir ? createMirrorFiles(settings.mirrorDir) : null,
    clock: { now },
    logger: basics.logger,
    sleep: basics.sleep,
    wait: options.wait ?? realSleep,
    config: engineConfig(options),
    memo: memo(now),
    running: new Map(),
  };
  prune(deps);
  return { deps, context: { deps, budget: options.budget ?? 40_000 }, close: () => stores.close() };
}
