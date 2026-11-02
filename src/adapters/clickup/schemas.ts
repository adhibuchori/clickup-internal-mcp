/**
 * The ClickUp response shapes this server reads, parsed leniently: unknown fields pass, missing
 * optional fields default, and ids or times that arrive as numbers or strings are both accepted
 * (API v2 sends times as strings of milliseconds, v3 as numbers).
 */
import { z } from 'zod';

const id = z.union([z.string(), z.number()]).transform(String);
const time = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => {
    const n = typeof value === 'string' ? Number(value) : value;
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
  });

const user = z.looseObject({
  id: z.number().optional().default(0),
  username: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

export const userResponse = z.looseObject({ user });
export const teamsResponse = z.looseObject({
  teams: z.array(z.looseObject({ id, members: z.array(z.looseObject({ user })).default([]) })),
});

const named = z.looseObject({ id, name: z.string().default('') });
export const spaceSchema = named;
export const spacesResponse = z.looseObject({ spaces: z.array(named) });

export const listSchema = z.looseObject({
  id,
  name: z.string().default(''),
  task_count: z.union([z.number(), z.string(), z.null()]).optional(),
  folder: z
    .looseObject({ id, name: z.string().default(''), hidden: z.boolean().optional() })
    .nullable()
    .optional(),
  space: z.looseObject({ id }).nullable().optional(),
});
export const listsResponse = z.looseObject({ lists: z.array(listSchema) });

export const folderSchema = z.looseObject({
  id,
  name: z.string().default(''),
  space: z.looseObject({ id }).nullable().optional(),
  lists: z.array(listSchema).default([]),
});
export const foldersResponse = z.looseObject({ folders: z.array(folderSchema) });

export const docSchema = z.looseObject({
  id,
  name: z.string().default('Untitled'),
  date_created: time,
  date_updated: time,
  creator: z.number().optional().default(0),
  parent: z.looseObject({ id, type: z.number() }).optional(),
});
export const docsResponse = z.looseObject({
  docs: z.array(docSchema),
  next_cursor: z.string().nullable().optional(),
});

export type RawPage = {
  id: string;
  name: string;
  content: string;
  date_updated: number | null;
  authors: number[];
  parent_page_id: string | null;
  pages: RawPage[];
};

const pageSchema: z.ZodType<RawPage> = z.lazy(() =>
  z.looseObject({
    id,
    name: z.string().default('Untitled'),
    content: z.string().default(''),
    date_updated: time,
    authors: z.array(z.number()).default([]),
    parent_page_id: id
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    pages: z.array(pageSchema).default([]),
  }),
);
export const pagesResponse = z.array(pageSchema);

const customFieldSchema = z.looseObject({
  name: z.string().default(''),
  type: z.string().default(''),
  value: z.unknown().optional(),
  type_config: z
    .looseObject({
      options: z
        .array(
          z.looseObject({
            id: id.optional(),
            name: z.string().optional(),
            label: z.string().optional(),
            orderindex: z.union([z.number(), z.string()]).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const taskCore = {
  id,
  custom_id: z.string().nullable().optional(),
  name: z.string().default(''),
  url: z.string().default(''),
  status: z
    .looseObject({ status: z.string().default(''), type: z.string().default('') })
    .optional(),
  list: z.looseObject({ id, name: z.string().default('') }).optional(),
  folder: z
    .looseObject({ id, name: z.string().default(''), hidden: z.boolean().optional() })
    .optional(),
  space: z.looseObject({ id }).optional(),
  assignees: z.array(user).default([]),
  tags: z.array(z.looseObject({ name: z.string() })).default([]),
  priority: z.looseObject({ priority: z.string() }).nullable().optional(),
  due_date: time,
  start_date: time,
  date_created: time,
  date_updated: time,
  date_closed: time,
  creator: user.optional(),
  parent: z.string().nullable().optional(),
  text_content: z.string().nullable().optional(),
  markdown_description: z.string().nullable().optional(),
  custom_fields: z.array(customFieldSchema).default([]),
  attachments: z
    .array(
      z.looseObject({
        title: z.string().default(''),
        url: z.string().default(''),
        extension: z.string().default(''),
        size: z.union([z.number(), z.string()]).nullable().optional(),
      }),
    )
    .default([]),
};

export const taskSchema = z.looseObject({
  ...taskCore,
  subtasks: z
    .array(z.looseObject({ id, name: z.string().default(''), status: taskCore.status }))
    .default([]),
});
export const tasksResponse = z.looseObject({
  tasks: z.array(taskSchema),
  last_page: z.boolean().optional(),
});

export const commentsResponse = z.looseObject({
  comments: z.array(
    z.looseObject({
      id,
      comment_text: z.string().default(''),
      user: user.optional(),
      date: time,
      resolved: z.boolean().optional().default(false),
      reply_count: z.union([z.number(), z.string()]).optional(),
    }),
  ),
});

export type TaskData = z.output<typeof taskSchema>;
export type CustomFieldData = z.output<typeof customFieldSchema>;
