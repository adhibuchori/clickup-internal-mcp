#!/usr/bin/env bun
/**
 * Measures the latency the server adds, against the fake ClickUp API (no network): a cached doc
 * read, a live task read, and a search over many tracked pages. Prints p50 and p95 per case.
 * Results that move go in docs/benchmarks.md.
 *
 *   bun run bench              # 2,000 pages
 *   bun run bench -- 10000     # 10,000 pages
 */
import { sampleData } from '../../src/testing/fixtures/clickup-data.ts';
import { createFakeClickUp } from '../../src/testing/mocks/fake-clickup.ts';
import { startTestRuntime } from '../../src/testing/helpers/test-runtime.ts';

const PAGES = Number(process.argv[2] ?? 2000);
const WORDS = [
  'checkout',
  'limit',
  'pelanggan',
  'approval',
  'alamat',
  'kurir',
  'keranjang',
  'notifikasi',
  'diskon',
  'stok',
];

const data = sampleData();
data.pages['8cdu22c-13133'] = Array.from({ length: PAGES }, (_, i) => ({
  id: `p-${i}`,
  name: `Halaman ${i}`,
  content: Array.from({ length: 60 }, (_unused, w) => WORDS[(i * 7 + w) % WORDS.length]).join(' '),
  pages: [],
}));
const t = await startTestRuntime({
  fake: createFakeClickUp(data),
  settings: { logLevel: 'error' },
});

async function measure(name: string, runs: number, work: () => Promise<unknown>): Promise<void> {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await work();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const pct = (p: number) =>
    (times[Math.min(times.length - 1, Math.floor(times.length * p))] ?? 0).toFixed(2);
  console.log(`${name.padEnd(36)} p50 ${pct(0.5)} ms   p95 ${pct(0.95)} ms`);
}

const syncStart = performance.now();
await t.call('track', { action: 'add', target: 'doc:8cdu22c-13133' });
console.log(`first sync of ${PAGES} pages: ${(performance.now() - syncStart).toFixed(0)} ms`);
await measure('read_doc page (cache hit)', 200, () =>
  t.call('read_doc', { doc: 'doc:8cdu22c-13133/page:p-42' }),
);
await measure('read_doc outline (cache hit)', 50, () =>
  t.call('read_doc', { doc: 'doc:8cdu22c-13133' }),
);
await measure('search, two words', 200, () => t.call('search', { query: 'limit pelanggan' }));
await measure('search, prefix of one word', 200, () => t.call('search', { query: 'notif' }));
await measure('read_task (memo after first read)', 200, () =>
  t.call('read_task', { task: 'task:86c1abcde', comments: false }),
);
await t.close();
