/**
 * References: the one way the server names a ClickUp thing in its answers, and the inputs every
 * tool accepts back. A reference is `task:86c1abcde`, `task:ABC-123` (a custom id),
 * `doc:8cdu22c-13133`, `doc:8cdu22c-13133/page:8cdu22c-4321`, `list:901812`, `folder:90181`,
 * `space:90180` or `img:3f2a9c1b7d4e`. A ClickUp URL from any *.clickup.com host (custom company
 * hosts such as acme.clickup.com included) and a bare task or doc id are accepted too.
 */
import { ToolError } from '../errors/tool-error.ts';

export type Ref =
  | { readonly kind: 'task'; readonly id: string; readonly custom: boolean }
  | { readonly kind: 'doc'; readonly docId: string; readonly pageId: string | null }
  | { readonly kind: 'list' | 'folder' | 'space'; readonly id: string }
  | { readonly kind: 'image'; readonly sha: string };

export type RefKind = Ref['kind'];

const CUSTOM_TASK = /^[A-Za-z][A-Za-z0-9]*-\d+$/;
const TASK_ID = /^(?=[a-z0-9]*[a-z])[a-z0-9]{5,16}$/;
const DOC_ID = /^[a-z0-9]+-\d+$/;
const NUMERIC = /^\d+$/;
const SHA = /^[0-9a-f]{8,64}$/;

/** View URLs encode the parent as "<type>-<id>-<n>": 4 space, 5 folder, 6 list. */
const VIEW_PARENT: Readonly<Record<string, 'space' | 'folder' | 'list'>> = {
  '4': 'space',
  '5': 'folder',
  '6': 'list',
};

function task(id: string): Ref {
  return { kind: 'task', id, custom: CUSTOM_TASK.test(id) };
}

function doc(docId: string, pageId: string | undefined): Ref {
  return { kind: 'doc', docId, pageId: pageId ?? null };
}

const PREFIXED: Readonly<Record<string, (id: string) => Ref | null>> = {
  task: (id) => task(id),
  doc: (id) => doc(id, undefined),
  img: (id) => (SHA.test(id) ? { kind: 'image', sha: id } : null),
  list: (id) => ({ kind: 'list', id }),
  folder: (id) => ({ kind: 'folder', id }),
  space: (id) => ({ kind: 'space', id }),
};

function prefixed(input: string): Ref | null {
  const page = /^doc:([^/\s]+)\/page:([^/\s]+)$/.exec(input);
  if (page?.[1] && page[2]) return doc(page[1], page[2]);
  const match = /^(task|doc|list|folder|space|img):([^/\s]+)$/.exec(input);
  const build = match?.[1] ? PREFIXED[match[1]] : undefined;
  return build && match?.[2] ? build(match[2]) : null;
}

function fromViewSegment(segment: string): Ref | null {
  const match = /^(\d)-(\d+)-\d+$/.exec(segment);
  const kind = match?.[1] ? VIEW_PARENT[match[1]] : undefined;
  return kind && match?.[2] ? { kind, id: match[2] } : null;
}

function fromViewPath(parts: readonly string[]): Ref | null {
  const at = parts.indexOf('v');
  const type = parts[at + 1];
  const first = parts[at + 2];
  if (at < 0 || !type || !first) return null;
  if (type === 'dc') return doc(first, parts[at + 3]);
  if (type === 'li') return { kind: 'list', id: first };
  if (type === 'f') return { kind: 'folder', id: first };
  if (type === 's') return { kind: 'space', id: first };
  return fromViewSegment(first);
}

function fromUrl(input: string): Ref | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.hostname !== 'clickup.com' && !url.hostname.endsWith('.clickup.com')) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 't') return parts[2] ? task(parts[2]) : parts[1] ? task(parts[1]) : null;
  const shared = parts.indexOf('d');
  const sharedDoc = shared >= 0 && parts[shared + 1] === 'h' ? parts[shared + 2] : undefined;
  if (sharedDoc) return doc(sharedDoc, parts[shared + 4]);
  return fromViewPath(parts);
}

function bare(input: string): Ref | null {
  const id = input.replace(/^#/, '');
  if (CUSTOM_TASK.test(id) && /[A-Z]/.test(id)) return task(id);
  if (DOC_ID.test(id)) return doc(id, undefined);
  if (TASK_ID.test(id)) return task(id);
  return null;
}

/** The reference in the input, or null. Numeric ids alone are ambiguous and are not guessed. */
export function parseRef(input: string): Ref | null {
  const text = input.trim();
  if (text.length === 0 || text.length > 2048) return null;
  if (/^https?:\/\//i.test(text)) return fromUrl(text);
  return prefixed(text) ?? bare(text);
}

const EXAMPLES: Readonly<Record<RefKind, string>> = {
  task: 'task:86c1abcde, task:ABC-123 or a task URL',
  doc: 'doc:8cdu22c-13133, doc:8cdu22c-13133/page:8cdu22c-4321 or a doc URL',
  list: 'list:901812345678 or a list URL',
  folder: 'folder:90181234567 or a folder URL',
  space: 'space:90180123456 or a space URL',
  image: 'img:3f2a9c1b7d4e (from read_doc or read_task)',
};

/** Parses and checks the kind; anything else is a ToolError that shows valid examples. */
export function requireRef<K extends RefKind>(
  input: string,
  kinds: readonly K[],
): Extract<Ref, { kind: K }> {
  const ref = parseRef(input);
  const accepted = (r: Ref | null): r is Extract<Ref, { kind: K }> =>
    r !== null && (kinds as readonly RefKind[]).includes(r.kind);
  if (accepted(ref)) return ref;
  const hint = kinds.map((kind) => EXAMPLES[kind]).join('; ');
  const numeric = NUMERIC.test(input.trim()) ? ' A bare number is ambiguous: add its kind.' : '';
  throw new ToolError(
    `"${input.slice(0, 80)}" is not a reference this tool accepts.${numeric}`,
    hint,
  );
}

export function formatRef(ref: Ref): string {
  switch (ref.kind) {
    case 'task':
      return `task:${ref.id}`;
    case 'doc':
      return ref.pageId ? `doc:${ref.docId}/page:${ref.pageId}` : `doc:${ref.docId}`;
    case 'image':
      return `img:${ref.sha.slice(0, 12)}`;
    default:
      return `${ref.kind}:${ref.id}`;
  }
}
