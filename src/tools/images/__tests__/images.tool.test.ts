import { afterEach, beforeEach, expect, test } from 'bun:test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { IMAGE_URL } from '../../../testing/fixtures/clickup-data.ts';
import { startTestRuntime, type TestRuntime } from '../../../testing/helpers/test-runtime.ts';

let t: TestRuntime;
beforeEach(async () => {
  t = await startTestRuntime();
});
afterEach(async () => {
  await t.close();
});

async function trackedRef(): Promise<string> {
  await t.call('track', { action: 'add', target: 'doc:8cdu22c-13133' });
  const { text } = await t.call('read_doc', { doc: 'doc:8cdu22c-13133/page:8cdu22c-4321' });
  return /\[image (img:[0-9a-f]{12})/.exec(text)?.[1] ?? '';
}

test('view_image returns the image inline, then note_image saves what it shows', async () => {
  const ref = await trackedRef();
  const view = await t.call('view_image', { image: ref });
  expect(view.image).toEqual({
    data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 1, 1, 1]).toString(
      'base64',
    ),
    mimeType: 'image/png',
  });
  expect(view.text).toContain(`${ref} · image/png · 1 KB`);
  expect(view.text).toContain('No note yet');
  expect((await t.call('note_image', { image: ref, note: '  Form checkout  ' })).text).toBe(
    `Saved the note for ${ref}.`,
  );
  expect((await t.call('view_image', { image: ref })).text).toContain('Saved note: Form checkout');
  expect((await t.call('track', { action: 'list' })).text).not.toContain('no note yet');
});

test('an image URL is downloaded on demand; hosts off the list are refused', async () => {
  const view = await t.call('view_image', { image: IMAGE_URL });
  expect(view.image?.mimeType).toBe('image/png');
  const again = await t.call('view_image', { image: IMAGE_URL });
  expect(again.isError).toBe(false);
  expect(t.fake.calls.filter((u) => u === IMAGE_URL)).toHaveLength(1);
  const evil = await t.call('view_image', { image: 'https://evil.example.com/x.png' });
  expect(evil.text).toContain('That image could not be downloaded.');
  const unknown = await t.call('view_image', { image: 'img:0123456789ab' });
  expect(unknown.text).toContain('No image with that reference in the cache.');
  expect((await t.call('note_image', { image: 'task:86c1abcde', note: 'x' })).isError).toBe(true);
});

test('images that cannot be shown inline say why', async () => {
  t.fake.data.images[IMAGE_URL] = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  );
  const svg = await t.call('view_image', { image: IMAGE_URL });
  expect(svg.image).toBeNull();
  expect(svg.text).toContain('Not shown: It is image/svg+xml, which cannot be shown inline.');
  const big = 'https://t9001.p.clickup-attachments.com/big.png';
  t.fake.data.images[big] = new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    ...new Uint8Array(6 * 1024 * 1024),
  ]);
  expect((await t.call('view_image', { image: big })).text).toContain(
    'larger than the inline image limit',
  );
});

test('a cached image whose file went missing asks for a re-sync', async () => {
  const ref = await trackedRef();
  rmSync(join(t.dir, 'data', 'assets'), { recursive: true, force: true });
  const view = await t.call('view_image', { image: ref });
  expect(view.text).toContain('The image file is missing from the cache; sync the doc again.');
});
