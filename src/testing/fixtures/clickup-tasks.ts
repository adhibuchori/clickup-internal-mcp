/** Tasks as the ClickUp API v2 returns them: times are strings of milliseconds. */
import { HOUR, IMAGE_URL_2, T0 } from './workspace.ts';

type Raw = Record<string, unknown>;

function customFields(): Raw[] {
  return [
    {
      name: 'Channel',
      type: 'drop_down',
      value: 1,
      type_config: {
        options: [
          { id: 'a', name: 'Web', orderindex: 0 },
          { id: 'b', name: 'Mobile', orderindex: 1 },
        ],
      },
    },
    {
      name: 'Areas',
      type: 'labels',
      value: ['x'],
      type_config: { options: [{ id: 'x', label: 'Orders' }] },
    },
    { name: 'Go live', type: 'date', value: String(T0 + 72 * HOUR) },
    { name: 'Reviewed', type: 'checkbox', value: true },
    { name: 'Owner', type: 'users', value: [{ id: 12, username: 'bob' }] },
    { name: 'Note', type: 'short_text', value: 'ok' },
    { name: 'Empty', type: 'short_text' },
  ];
}

function peopleAndDates(): Raw {
  return {
    assignees: [{ id: 11, username: 'alice', email: 'alice@example.com' }],
    creator: { id: 12, username: 'bob', email: 'bob@example.com' },
    tags: [{ name: 'checkout' }],
    priority: { priority: 'high' },
    due_date: String(T0 + 48 * HOUR),
    start_date: null,
    date_created: String(T0 - 240 * HOUR),
    date_updated: String(T0 - 2 * HOUR),
    date_closed: null,
  };
}

export function rawTask(over: Raw = {}): Raw {
  return {
    id: '86c1abcde',
    custom_id: 'MOB-1',
    name: 'Checkout pesanan',
    url: 'https://app.clickup.com/t/86c1abcde',
    status: { status: 'in progress', type: 'custom' },
    list: { id: '300', name: 'Sprint 42' },
    folder: { id: '200', name: 'Mobile App', hidden: false },
    space: { id: '100' },
    ...peopleAndDates(),
    parent: null,
    text_content: 'plain text',
    markdown_description: `## Acceptance\n- Maksimal 20 barang per pesanan\n\n![flow](${IMAGE_URL_2})`,
    custom_fields: customFields(),
    subtasks: [{ id: '86c1sub01', name: 'API contract', status: { status: 'to do' } }],
    attachments: [
      {
        title: 'spec.pdf',
        url: 'https://t9001.p.clickup-attachments.com/spec.pdf',
        extension: 'pdf',
        size: 2048,
      },
    ],
    ...over,
  };
}

export function rawSecondTask(): Raw {
  return rawTask({
    id: '86c1fghij',
    custom_id: null,
    name: 'Backlog item',
    url: 'https://app.clickup.com/t/86c1fghij',
    status: { status: 'to do', type: 'open' },
    list: { id: '301', name: 'Backlog' },
    folder: { id: '999', name: 'hidden', hidden: true },
    assignees: [],
    tags: [],
    priority: null,
    due_date: null,
    date_updated: String(T0 - 30 * HOUR),
    markdown_description: null,
    text_content: 'Only plain text here',
    custom_fields: [],
    subtasks: [],
    attachments: [],
  });
}
