/**
 * Line diff between two revisions of a page, rendered as hunks with a little context: what the
 * `changes` tool shows when a requirement doc moved. The common head and tail are trimmed first
 * (most edits touch one spot), then an LCS table covers the middle. A middle too large for the table
 * falls back to the lines removed and added, which is still correct, only less ordered.
 */
export interface DiffResult {
  readonly lines: readonly string[];
  readonly added: number;
  readonly removed: number;
}

type Op = { readonly kind: ' ' | '-' | '+'; readonly text: string };

const MAX_CELLS = 4_000_000;

function same(text: string): Op {
  return { kind: ' ', text };
}

function lcsTable(a: readonly string[], b: readonly string[]): Uint32Array {
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i * width + j] =
        a[i] === b[j]
          ? (table[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0);
  return table;
}

/**
 * Which way the LCS walk steps from (i, j): keep a shared line, remove from a, or add from b. On a
 * tie the removal comes first, as in a unified diff.
 */
function step(
  a: readonly string[],
  b: readonly string[],
  at: { i: number; j: number; table: Uint32Array },
): Op['kind'] {
  const { i, j, table } = at;
  const width = b.length + 1;
  if (i < a.length && j < b.length && a[i] === b[j]) return ' ';
  if (j >= b.length) return '-';
  if (i >= a.length) return '+';
  return (table[i * width + j + 1] ?? 0) > (table[(i + 1) * width + j] ?? 0) ? '+' : '-';
}

function lcsOps(a: readonly string[], b: readonly string[]): Op[] {
  const table = lcsTable(a, b);
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const kind = step(a, b, { i, j, table });
    ops.push({ kind, text: (kind === '+' ? b[j] : a[i]) ?? '' });
    if (kind !== '+') i++;
    if (kind !== '-') j++;
  }
  return ops;
}

function bagOps(a: readonly string[], b: readonly string[]): Op[] {
  const before = new Set(a);
  const after = new Set(b);
  return [
    ...a.filter((line) => !after.has(line)).map((text): Op => ({ kind: '-', text })),
    ...b.filter((line) => !before.has(line)).map((text): Op => ({ kind: '+', text })),
  ];
}

function middleOps(a: readonly string[], b: readonly string[]): Op[] {
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  )
    tail++;
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const middle =
    (midA.length + 1) * (midB.length + 1) <= MAX_CELLS ? lcsOps(midA, midB) : bagOps(midA, midB);
  return [...a.slice(0, head).map(same), ...middle, ...a.slice(a.length - tail).map(same)];
}

/** Hunks of changed lines with `context` unchanged lines around each. */
export function diffLines(before: string, after: string, context = 2): DiffResult {
  const ops = middleOps(before.split('\n'), after.split('\n'));
  const keep = ops.map(() => false);
  ops.forEach((op, index) => {
    if (op.kind === ' ') return;
    for (let k = Math.max(0, index - context); k <= Math.min(ops.length - 1, index + context); k++)
      keep[k] = true;
  });
  const lines: string[] = [];
  let gap = false;
  ops.forEach((op, index) => {
    if (!keep[index]) {
      gap = lines.length > 0;
      return;
    }
    if (gap) lines.push('…');
    gap = false;
    lines.push(`${op.kind} ${op.text}`);
  });
  return {
    lines,
    added: ops.filter((op) => op.kind === '+').length,
    removed: ops.filter((op) => op.kind === '-').length,
  };
}
