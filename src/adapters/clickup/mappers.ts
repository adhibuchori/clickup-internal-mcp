/** From parsed ClickUp responses to the domain shapes in core/model. */
import type {
  Comment,
  DocSummary,
  Folder,
  ListInfo,
  Member,
  Page,
  Task,
} from '../../core/model/clickup.types.ts';
import { customFields } from './custom-fields.ts';
import type { z } from 'zod';
import type {
  commentsResponse,
  docSchema,
  folderSchema,
  listSchema,
  RawPage,
  TaskData,
} from './schemas.ts';

type UserData = {
  id: number;
  username?: string | null | undefined;
  email?: string | null | undefined;
};

export function toMember(user: UserData): Member {
  return { id: user.id, username: user.username ?? `user ${user.id}`, email: user.email ?? '' };
}

function count(value: number | string | null | undefined): number | null {
  const n = Number(value);
  return value === null || value === undefined || !Number.isFinite(n) ? null : n;
}

export function toList(list: z.output<typeof listSchema>): ListInfo {
  const visibleFolder = list.folder && !list.folder.hidden ? list.folder : null;
  return {
    id: list.id,
    name: list.name,
    taskCount: count(list.task_count),
    folderId: visibleFolder?.id ?? null,
    folderName: visibleFolder?.name ?? null,
    spaceId: list.space?.id ?? null,
  };
}

export function toFolder(folder: z.output<typeof folderSchema>): Folder {
  return {
    id: folder.id,
    name: folder.name,
    spaceId: folder.space?.id ?? null,
    lists: folder.lists.map((list) => ({
      ...toList(list),
      folderId: folder.id,
      folderName: folder.name,
    })),
  };
}

export function toDoc(doc: z.output<typeof docSchema>): DocSummary {
  return {
    id: doc.id,
    name: doc.name,
    parentId: doc.parent?.id ?? '',
    parentType: doc.parent?.type ?? 0,
    creator: doc.creator,
    dateCreated: doc.date_created ?? 0,
    dateUpdated: doc.date_updated,
  };
}

/** Depth-first, parents before children, in ClickUp's order. */
export function flattenPages(docId: string, pages: readonly RawPage[]): Page[] {
  const out: Page[] = [];
  const walk = (list: readonly RawPage[], depth: number, parent: string | null): void => {
    for (const page of list) {
      out.push({
        id: page.id,
        docId,
        parentPageId: page.parent_page_id ?? parent,
        name: page.name,
        content: page.content,
        dateUpdated: page.date_updated,
        authors: page.authors,
        position: out.length,
        depth,
      });
      walk(page.pages, depth + 1, page.id);
    }
  };
  walk(pages, 0, null);
  return out;
}

const NO_FOLDER = { id: null, name: null };

function place(
  task: TaskData,
): Pick<Task, 'listId' | 'listName' | 'folderId' | 'folderName' | 'spaceId'> {
  const list = task.list ?? { id: '', name: '' };
  const folder = task.folder && task.folder.hidden !== true ? task.folder : NO_FOLDER;
  return {
    listId: list.id,
    listName: list.name,
    folderId: folder.id,
    folderName: folder.name,
    spaceId: task.space?.id ?? '',
  };
}

function dates(
  task: TaskData,
): Pick<Task, 'dueDate' | 'startDate' | 'dateCreated' | 'dateUpdated' | 'dateClosed'> {
  return {
    dueDate: task.due_date,
    startDate: task.start_date,
    dateCreated: task.date_created ?? 0,
    dateUpdated: task.date_updated ?? task.date_created ?? 0,
    dateClosed: task.date_closed,
  };
}

function people(
  task: TaskData,
): Pick<Task, 'assignees' | 'creator' | 'tags' | 'priority' | 'parentId'> {
  return {
    assignees: task.assignees.map((user) => toMember(user).username),
    creator: task.creator ? toMember(task.creator).username : '',
    tags: task.tags.map((tag) => tag.name),
    priority: task.priority?.priority ?? null,
    parentId: task.parent ?? null,
  };
}

export function toTask(task: TaskData, timeZone: string): Task {
  return {
    id: task.id,
    customId: task.custom_id ?? null,
    name: task.name,
    url: task.url,
    status: task.status?.status ?? '',
    statusType: task.status?.type ?? '',
    ...place(task),
    ...dates(task),
    ...people(task),
    description: task.markdown_description ?? task.text_content ?? '',
    customFields: customFields(task.custom_fields, timeZone),
    subtasks: task.subtasks.map((sub) => ({
      id: sub.id,
      name: sub.name,
      status: sub.status?.status ?? '',
    })),
    attachments: task.attachments.map((a) => ({
      title: a.title,
      url: a.url,
      extension: a.extension,
      size: count(a.size),
    })),
  };
}

export function toComments(taskId: string, data: z.output<typeof commentsResponse>): Comment[] {
  return data.comments.map((c) => ({
    id: c.id,
    taskId,
    author: c.user ? toMember(c.user).username : 'unknown',
    date: c.date ?? 0,
    text: c.comment_text,
    resolved: c.resolved,
    replies: count(c.reply_count) ?? 0,
  }));
}
