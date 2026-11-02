import { afterEach, beforeEach, expect, test } from 'bun:test';
import { IMAGE_URL } from '../../../testing/fixtures/clickup-data.ts';
import { startTestRuntime, type TestRuntime } from '../../../testing/helpers/test-runtime.ts';

const DOC = 'https://acme.clickup.com/9001/v/dc/8cdu22c-13133';
let t: TestRuntime;
beforeEach(async () => {
  t = await startTestRuntime();
});
afterEach(async () => {
  await t.close();
});

test('an untracked doc is read live and shows its outline with the creator name', async () => {
  const { text, isError } = await t.call('read_doc', { doc: DOC });
  expect(isError).toBe(false);
  expect(text).toContain('Doc: Checkout Requirements (doc:8cdu22c-13133) · live read (not tracked');
  expect(text).toContain('by bob · updated 5h ago · 2 pages');
  expect(text).toContain('  doc:8cdu22c-13133/page:8cdu22c-4321  Overview (');
  expect(text).toContain('chars, 1 image)');
  expect(text).toContain('    doc:8cdu22c-13133/page:8cdu22c-4322  Limits (');
});

test('a page shows Markdown, image lines and embeds; live images are not downloaded', async () => {
  const { text } = await t.call('read_doc', { doc: `${DOC}/8cdu22c-4321` });
  expect(text).toContain('## Overview (doc:8cdu22c-13133/page:8cdu22c-4321)');
  expect(text).toContain(
    `[image "mockup layar checkout": not downloaded. view_image ${IMAGE_URL}]`,
  );
  expect(text).toContain(
    'Linked content not readable as text here:\n  figma: https://www.figma.com/file/abc123/Checkout',
  );
  expect(t.fake.calls.some((url) => url === IMAGE_URL)).toBe(false);
});

test('pages by name, the full doc, and a memo for repeated live reads', async () => {
  expect((await t.call('read_doc', { doc: 'doc:8cdu22c-13133', page: 'limit' })).text).toContain(
    'Maksimal 20 barang per pesanan',
  );
  const calls = t.fake.calls.length;
  const full = await t.call('read_doc', { doc: 'doc:8cdu22c-13133', mode: 'full' });
  expect(full.text).toContain('## Overview');
  expect(full.text).toContain('## Limits');
  expect(t.fake.calls.length).toBe(calls);
  await t.call('read_doc', { doc: 'doc:8cdu22c-13133', fresh: true });
  expect(t.fake.calls.length).toBeGreaterThan(calls);
});

test('a one-page doc shows its page directly; an empty page says so', async () => {
  t.fake.data.pages['8cdu22c-300'] = [
    { id: '8cdu22c-301', name: 'Notes', content: '  ', pages: [] },
  ];
  const { text } = await t.call('read_doc', { doc: 'doc:8cdu22c-300' });
  expect(text).toContain('## Notes (doc:8cdu22c-300/page:8cdu22c-301)\n\n(empty page)');
  expect(text).not.toContain('by ');
});

test('long content is cut into cursor parts on paragraph breaks', async () => {
  const paragraphs = Array.from({ length: 40 }, (_, i) => `Paragraf ${i} ${'x'.repeat(80)}`).join(
    '\n\n',
  );
  t.fake.data.pages['8cdu22c-300'] = [
    { id: '8cdu22c-301', name: 'Long', content: paragraphs, pages: [] },
  ];
  const small = await startTestRuntime({ fake: t.fake, runtime: { budget: 1500 } });
  const first = await small.call('read_doc', { doc: 'doc:8cdu22c-300' });
  const cursor = /cursor "([^"]+)"/.exec(first.text)?.[1] ?? '';
  expect(cursor).not.toBe('');
  const second = await small.call('read_doc', { doc: 'doc:8cdu22c-300', cursor });
  expect(second.text).not.toContain('Paragraf 0 ');
  const foreign = await small.call('read_doc', { doc: 'doc:8cdu22c-300', mode: 'full', cursor });
  expect(foreign.isError).toBe(true);
  await small.close();
});

test('errors: unknown page, missing doc, wrong reference', async () => {
  const page = await t.call('read_doc', { doc: 'doc:8cdu22c-13133', page: 'nonexistent' });
  expect(page.text).toContain('No page "nonexistent" in this doc.');
  const missing = await t.call('read_doc', { doc: 'doc:8cdu22c-9' });
  expect(missing.text).toContain('No doc with that id in this workspace.');
  expect((await t.call('read_doc', { doc: 'list:300' })).isError).toBe(true);
});

test('a tracked doc is served from the cache, re-synced when stale, with image refs and notes', async () => {
  await t.call('track', { action: 'add', target: DOC });
  const docCalls = () => t.fake.calls.filter((url) => url.includes('/docs')).length;
  const calls = docCalls();
  const cached = await t.call('read_doc', { doc: `${DOC}/8cdu22c-4321` });
  expect(docCalls()).toBe(calls);
  expect(cached.text).toContain('tracked, synced just now');
  const ref = /\[image (img:[0-9a-f]{12}) "mockup layar checkout": no note yet/.exec(
    cached.text,
  )?.[1];
  expect(ref).toBeDefined();
  await t.call('note_image', {
    image: ref,
    note: 'Form checkout: alamat pengiriman, kurir, tombol Bayar.',
  });
  t.clock.advance(31 * 60_000);
  const resynced = await t.call('read_doc', { doc: `${DOC}/8cdu22c-4321` });
  expect(docCalls()).toBeGreaterThan(calls);
  expect(resynced.text).toContain(
    `[image ${ref} "mockup layar checkout". Note: Form checkout: alamat pengiriman, kurir, tombol Bayar.]`,
  );
});

test('a tracked doc falls back to its cached copy when ClickUp is unreachable, but not on 404', async () => {
  await t.call('track', { action: 'add', target: DOC });
  t.fake.failures.push({ match: /8cdu22c-13133/, status: 503, times: 10 });
  const offline = await t.call('read_doc', { doc: DOC, fresh: true });
  expect(offline.text).toContain(
    'Note: ClickUp could not be reached; showing the copy from the last sync.',
  );
  t.fake.failures.length = 0;
  t.fake.failures.push({ match: /8cdu22c-13133/, status: 404, times: 2 });
  const gone = await t.call('read_doc', { doc: DOC, fresh: true });
  expect(gone.isError).toBe(true);
});
