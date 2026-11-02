/**
 * The ClickUp API as the engine sees it: read-only by construction. There is no method here that
 * changes anything in ClickUp; a writer, if one is ever added, is a separate port wired only when
 * the user turns it on.
 */
import type {
  Comment,
  DocSummary,
  Folder,
  ListInfo,
  Member,
  Page,
  Space,
  Task,
} from '../core/model/clickup.types.ts';

interface DocsQuery {
  readonly parentId?: string;
  readonly parentType?: number;
  readonly cursor?: string;
}

export interface TaskQuery {
  readonly listIds?: readonly string[];
  readonly folderIds?: readonly string[];
  readonly spaceIds?: readonly string[];
  readonly statuses?: readonly string[];
  readonly assignees?: readonly number[];
  readonly tags?: readonly string[];
  readonly includeClosed?: boolean;
  readonly updatedAfter?: number;
  readonly dueBefore?: number;
  readonly orderBy?: 'updated' | 'due_date' | 'created';
  readonly page: number;
}

interface Download {
  readonly bytes: Uint8Array;
  readonly mime: string;
}

export interface ClickUpReader {
  me(): Promise<Member>;
  members(): Promise<Member[]>;
  spaces(): Promise<Space[]>;
  space(id: string): Promise<Space>;
  folders(spaceId: string): Promise<Folder[]>;
  folder(id: string): Promise<Folder>;
  folderlessLists(spaceId: string): Promise<ListInfo[]>;
  list(id: string): Promise<ListInfo>;
  docs(query: DocsQuery): Promise<{ docs: DocSummary[]; nextCursor: string | null }>;
  doc(id: string): Promise<DocSummary>;
  /** Every page of the doc with its Markdown, flattened depth-first. */
  pages(docId: string): Promise<Page[]>;
  task(id: string, custom: boolean): Promise<Task>;
  /** One page of up to 100 tasks. */
  tasks(query: TaskQuery): Promise<{ tasks: Task[]; lastPage: boolean }>;
  comments(taskId: string): Promise<Comment[]>;
  /** Downloads an image from an allowed host. */
  download(url: string): Promise<Download>;
}
