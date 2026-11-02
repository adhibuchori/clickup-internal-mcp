/**
 * A small, realistic workspace as the ClickUp API returns it (raw JSON shapes, v2 times as strings
 * of milliseconds, v3 times as numbers). Every test builds a fresh copy and changes what it needs.
 */
import { rawSecondTask, rawTask } from './clickup-tasks.ts';
import { HOUR, IMAGE_URL, IMAGE_URL_2, pngBytes, T0 } from './workspace.ts';

export { rawTask } from './clickup-tasks.ts';
export { IMAGE_URL, T0, WORKSPACE } from './workspace.ts';

function rawPages(): Record<string, unknown>[] {
  return [
    {
      id: '8cdu22c-4321',
      name: 'Overview',
      content: `# Overview\nCheckout untuk pelanggan toko online.\n\n![mockup layar checkout](${IMAGE_URL})\n\nDesain: https://www.figma.com/file/abc123/Checkout`,
      date_updated: T0 - 5 * HOUR,
      authors: [12],
      pages: [
        {
          id: '8cdu22c-4322',
          name: 'Limits',
          content: 'Maksimal 20 barang per pesanan pelanggan.',
          date_updated: T0 - 5 * HOUR,
          authors: [11],
          pages: [],
        },
      ],
    },
  ];
}

export interface FakeData {
  user: Record<string, unknown>;
  members: Record<string, unknown>[];
  spaces: Record<string, unknown>[];
  folders: Record<string, Record<string, unknown>[]>;
  lists: Record<string, Record<string, unknown>[]>;
  docs: Record<string, unknown>[];
  pages: Record<string, Record<string, unknown>[]>;
  tasks: Record<string, unknown>[];
  comments: Record<string, Record<string, unknown>[]>;
  images: Record<string, Uint8Array>;
}

function hierarchy(): Pick<FakeData, 'user' | 'members' | 'spaces' | 'folders' | 'lists'> {
  const sprint = {
    id: '300',
    name: 'Sprint 42',
    task_count: 1,
    folder: { id: '200', name: 'Mobile App', hidden: false },
    space: { id: '100' },
  };
  return {
    user: { id: 11, username: 'alice', email: 'alice@example.com' },
    members: [
      { id: 11, username: 'alice', email: 'alice@example.com' },
      { id: 12, username: 'bob', email: 'bob@example.com' },
    ],
    spaces: [{ id: '100', name: 'Online Store' }],
    folders: { '100': [{ id: '200', name: 'Mobile App', space: { id: '100' }, lists: [sprint] }] },
    lists: {
      '100': [
        {
          id: '301',
          name: 'Backlog',
          task_count: '1',
          folder: { id: '999', name: 'hidden', hidden: true },
          space: { id: '100' },
        },
      ],
    },
  };
}

function docs(): Pick<FakeData, 'docs'> {
  return {
    docs: [
      {
        id: '8cdu22c-13133',
        name: 'Checkout Requirements',
        date_created: T0 - 500 * HOUR,
        date_updated: T0 - 5 * HOUR,
        creator: 12,
        parent: { id: '300', type: 6 },
      },
      {
        id: '8cdu22c-200',
        name: 'Space Handbook',
        date_created: T0 - 900 * HOUR,
        creator: 11,
        parent: { id: '100', type: 4 },
      },
      {
        id: '8cdu22c-300',
        name: 'Folder Notes',
        date_created: T0 - 900 * HOUR,
        creator: 99,
        parent: { id: '200', type: 5 },
      },
    ],
  };
}

function pages(): Pick<FakeData, 'pages'> {
  return {
    pages: {
      '8cdu22c-13133': rawPages(),
      '8cdu22c-200': [
        {
          id: '8cdu22c-201',
          name: 'Handbook',
          content: 'Cara kerja tim toko.',
          date_updated: T0 - 100 * HOUR,
          authors: [11],
          pages: [],
        },
      ],
      '8cdu22c-300': [
        { id: '8cdu22c-301', name: 'Notes', content: 'Catatan folder.', authors: [], pages: [] },
      ],
    },
  };
}

function work(): Pick<FakeData, 'tasks' | 'comments' | 'images'> {
  return {
    tasks: [rawTask(), rawSecondTask()],
    comments: {
      '86c1abcde': [
        {
          id: 'c1',
          comment_text: 'Batas sudah disetujui tim produk.',
          user: { id: 12, username: 'bob' },
          date: String(T0 - 3 * HOUR),
          resolved: false,
          reply_count: 1,
        },
        {
          id: 'c2',
          comment_text: 'Siap, lanjut.',
          user: { id: 11, username: 'alice' },
          date: String(T0 - 2 * HOUR),
          resolved: true,
        },
      ],
    },
    images: { [IMAGE_URL]: pngBytes(1), [IMAGE_URL_2]: pngBytes(2) },
  };
}

export function sampleData(): FakeData {
  return { ...hierarchy(), ...docs(), ...pages(), ...work() };
}
