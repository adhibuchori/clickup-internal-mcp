/** Schemas for the domain objects stored as JSON, so reading them back needs no type assertion. */
import { z } from 'zod';

const nullableNumber = z.number().nullable();

export const docSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string(),
  parentType: z.number(),
  creator: z.number(),
  dateCreated: z.number(),
  dateUpdated: nullableNumber,
});

export const pageSchema = z.object({
  id: z.string(),
  docId: z.string(),
  parentPageId: z.string().nullable(),
  name: z.string(),
  content: z.string(),
  dateUpdated: nullableNumber,
  authors: z.array(z.number()),
  position: z.number(),
  depth: z.number(),
});

export const taskSchema = z.object({
  id: z.string(),
  customId: z.string().nullable(),
  name: z.string(),
  url: z.string(),
  status: z.string(),
  statusType: z.string(),
  listId: z.string(),
  listName: z.string(),
  folderId: z.string().nullable(),
  folderName: z.string().nullable(),
  spaceId: z.string(),
  assignees: z.array(z.string()),
  tags: z.array(z.string()),
  priority: z.string().nullable(),
  dueDate: nullableNumber,
  startDate: nullableNumber,
  dateCreated: z.number(),
  dateUpdated: z.number(),
  dateClosed: nullableNumber,
  creator: z.string(),
  parentId: z.string().nullable(),
  description: z.string(),
  customFields: z.array(z.object({ name: z.string(), value: z.string() })),
  subtasks: z.array(z.object({ id: z.string(), name: z.string(), status: z.string() })),
  attachments: z.array(
    z.object({ title: z.string(), url: z.string(), extension: z.string(), size: nullableNumber }),
  ),
});

export const commentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  author: z.string(),
  date: z.number(),
  text: z.string(),
  resolved: z.boolean(),
  replies: z.number(),
});
