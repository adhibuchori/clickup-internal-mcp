/**
 * The local cache, split by concern. Only what the user tracks is stored; live reads of anything
 * else stay in memory. A scope is the tracked thing a row came from ("doc:…", "list:…", "folder:…",
 * "space:…"), so untracking removes exactly its rows.
 */
import type { Comment, DocSummary, Member, Page, Task } from '../core/model/clickup.types.ts';

export type ScopeKind = 'doc' | 'list' | 'folder' | 'space';

export interface Tracked {
  readonly kind: ScopeKind;
  readonly id: string;
  readonly name: string;
  readonly addedAt: number;
  readonly syncedAt: number | null;
  /** Highest task date_updated seen, for incremental task sync. */
  readonly watermark: number;
  /** "ok", "syncing", or "error: <reason>". */
  readonly status: string;
}

export interface TrackStore {
  list(): Tracked[];
  get(kind: ScopeKind, id: string): Tracked | null;
  put(tracked: Tracked): void;
  remove(kind: ScopeKind, id: string): void;
}

export interface PageChange {
  readonly docId: string;
  readonly docName: string;
  readonly pageId: string;
  readonly pageName: string;
  readonly kind: 'added' | 'changed' | 'removed';
  readonly before: string | null;
  readonly after: string | null;
  readonly at: number;
}

interface StoredDoc {
  readonly doc: DocSummary;
  readonly scope: string;
  readonly syncedAt: number;
}

export interface DocStore {
  get(docId: string): StoredDoc | null;
  pages(docId: string): Page[];
  idsOfScope(scope: string): string[];
  /**
   * Saves the doc and its pages, keeps revisions and the search index current, and returns what
   * changed against the stored copy. `initial` marks a first sync, whose pages are not "changes".
   */
  save(input: {
    doc: DocSummary;
    scope: string;
    pages: readonly Page[];
    at: number;
    initial: boolean;
  }): PageChange[];
  remove(docId: string): void;
  changesSince(since: number): PageChange[];
}

export interface TaskEvent {
  readonly taskId: string;
  readonly name: string;
  readonly at: number;
  readonly what: string;
}

/** Where a batch of tasks came from and when; `initial` marks a first sync, whose tasks are not events. */
export interface TaskBatch {
  readonly scope: string;
  readonly at: number;
  readonly initial: boolean;
}

export interface TaskStore {
  /** By id or custom id. */
  get(id: string): { task: Task; syncedAt: number } | null;
  save(tasks: readonly Task[], batch: TaskBatch): TaskEvent[];
  saveComments(taskId: string, comments: readonly Comment[]): void;
  comments(taskId: string): Comment[];
  removeScope(scope: string): void;
  eventsSince(since: number): TaskEvent[];
}

export type HitKind = 'page' | 'task' | 'comment';

export interface SearchHit {
  readonly kind: HitKind;
  readonly ref: string;
  readonly title: string;
  readonly snippet: string;
  readonly scope: string;
}

export interface SearchQuery {
  readonly match: string;
  readonly kinds: readonly HitKind[];
  /** Only rows whose scope or ref starts with this. */
  readonly within: string | null;
  readonly limit: number;
  readonly offset: number;
}

export interface SearchIndex {
  search(query: SearchQuery): SearchHit[];
}

export interface Asset {
  readonly sha: string;
  readonly ext: string;
  readonly mime: string;
  readonly bytes: number;
  readonly sourceUrl: string;
}

export interface AssetIndex {
  bySource(url: string): Asset | null;
  /** By a unique sha prefix of at least 8 characters. */
  byPrefix(prefix: string): Asset | null;
  put(asset: Asset, at: number): void;
  link(docId: string, pageId: string, shas: readonly string[]): void;
  note(sha: string): string | null;
  setNote(sha: string, note: string, at: number): void;
  /** Linked images of tracked docs that have no note yet. */
  unnoted(limit: number): Asset[];
  /** Assets no page links to any more; their files can go. */
  orphans(): Asset[];
  remove(sha: string): void;
}

export interface MemberStore {
  names(ids: readonly number[]): Map<number, string>;
  save(members: readonly Member[]): void;
}

export interface MetaStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface Stores {
  readonly tracked: TrackStore;
  readonly docs: DocStore;
  readonly tasks: TaskStore;
  readonly search: SearchIndex;
  readonly assets: AssetIndex;
  readonly members: MemberStore;
  readonly meta: MetaStore;
  /** Drops revisions and events older than `before`, keeping the latest revision of every page. */
  prune(before: number): void;
  close(): void;
}
