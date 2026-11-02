/** Everything an engine service may use, handed in by the composition root. */
import type { TtlCache } from '../../core/cache/ttl-cache.ts';
import type { DocSummary, Member, Page, Task } from '../../core/model/clickup.types.ts';
import type { ClickUpReader } from '../../ports/clickup.ts';
import type { AssetFiles, MirrorFiles } from '../../ports/files.ts';
import type { Clock, Logger } from '../../ports/runtime.ts';
import type { Stores } from '../../ports/store.ts';

export interface EngineConfig {
  readonly workspaceId: string;
  readonly timeZone: string;
  readonly assetHosts: readonly string[];
  /** Largest image view_image returns inline. */
  readonly maxViewBytes: number;
  /** A tracked doc older than this is re-synced before it is read. */
  readonly staleMs: number;
  readonly ttlDays: number;
  /** How long `track` waits for a sync before letting it finish in the background. */
  readonly syncWaitMs: number;
}

interface LiveDoc {
  readonly doc: DocSummary;
  readonly pages: readonly Page[];
}

/** In-memory caches for live reads of untracked things: nothing untracked is written to disk. */
export interface Memo {
  readonly docs: TtlCache<LiveDoc>;
  readonly tasks: TtlCache<Task>;
  readonly text: TtlCache<string>;
  readonly me: TtlCache<Member>;
}

export interface ScopeSyncResult {
  readonly docs: number;
  readonly pageChanges: number;
  readonly tasks: number;
  readonly taskEvents: number;
  readonly images: number;
  readonly failedImages: number;
  /** True when more tasks wait for the next sync. */
  readonly more: boolean;
}

export interface EngineDeps {
  readonly clickup: ClickUpReader;
  readonly stores: Stores;
  readonly assets: AssetFiles;
  readonly mirror: MirrorFiles | null;
  readonly clock: Clock;
  readonly logger: Logger;
  /** Backoff between retries. */
  readonly sleep: (ms: number) => Promise<void>;
  /** The clock `track` waits on before letting a first sync finish in the background. */
  readonly wait: (ms: number) => Promise<void>;
  readonly config: EngineConfig;
  readonly memo: Memo;
  /** Syncs in progress, by scope key, so one scope never syncs twice at once. */
  readonly running: Map<string, Promise<ScopeSyncResult>>;
}
