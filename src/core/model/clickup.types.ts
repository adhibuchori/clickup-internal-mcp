/**
 * The ClickUp shapes the server works with, already normalised by the API adapter: times are epoch
 * milliseconds or null, ids are strings (members keep ClickUp's numeric ids), and every optional
 * field the API may omit has a definite empty value.
 */

export interface Member {
  readonly id: number;
  readonly username: string;
  readonly email: string;
}

export interface Space {
  readonly id: string;
  readonly name: string;
}

export interface ListInfo {
  readonly id: string;
  readonly name: string;
  readonly taskCount: number | null;
  readonly folderId: string | null;
  readonly folderName: string | null;
  readonly spaceId: string | null;
}

export interface Folder {
  readonly id: string;
  readonly name: string;
  readonly spaceId: string | null;
  readonly lists: readonly ListInfo[];
}

export interface DocSummary {
  readonly id: string;
  readonly name: string;
  readonly parentId: string;
  readonly parentType: number;
  readonly creator: number;
  readonly dateCreated: number;
  readonly dateUpdated: number | null;
}

export interface Page {
  readonly id: string;
  readonly docId: string;
  readonly parentPageId: string | null;
  readonly name: string;
  readonly content: string;
  readonly dateUpdated: number | null;
  readonly authors: readonly number[];
  /** Order in a depth-first walk of the page tree, from 0. */
  readonly position: number;
  /** 0 for a top-level page. */
  readonly depth: number;
}

interface Attachment {
  readonly title: string;
  readonly url: string;
  readonly extension: string;
  readonly size: number | null;
}

export interface Task {
  readonly id: string;
  readonly customId: string | null;
  readonly name: string;
  readonly url: string;
  readonly status: string;
  /** open, custom, closed or done. */
  readonly statusType: string;
  readonly listId: string;
  readonly listName: string;
  readonly folderId: string | null;
  readonly folderName: string | null;
  readonly spaceId: string;
  readonly assignees: readonly string[];
  readonly tags: readonly string[];
  readonly priority: string | null;
  readonly dueDate: number | null;
  readonly startDate: number | null;
  readonly dateCreated: number;
  readonly dateUpdated: number;
  readonly dateClosed: number | null;
  readonly creator: string;
  readonly parentId: string | null;
  /** Markdown when ClickUp sent it, plain text otherwise. */
  readonly description: string;
  readonly customFields: readonly { readonly name: string; readonly value: string }[];
  readonly subtasks: readonly {
    readonly id: string;
    readonly name: string;
    readonly status: string;
  }[];
  readonly attachments: readonly Attachment[];
}

export interface Comment {
  readonly id: string;
  readonly taskId: string;
  readonly author: string;
  readonly date: number;
  readonly text: string;
  readonly resolved: boolean;
  readonly replies: number;
}
