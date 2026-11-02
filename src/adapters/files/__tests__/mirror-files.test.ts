import { afterEach, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMirrorFiles } from '../mirror-files.ts';

const dir = mkdtempSync(join(tmpdir(), 'mirror-'));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test('writes nested files, removes folders, and never leaves the mirror folder', () => {
  const mirror = createMirrorFiles(dir);
  mirror.write('doc-1/01-page.md', '# Page');
  mirror.write('doc-1/assets/a.png', new Uint8Array([1]));
  expect(readFileSync(join(dir, 'doc-1', '01-page.md'), 'utf8')).toBe('# Page');
  mirror.removeDir('doc-1');
  expect(existsSync(join(dir, 'doc-1'))).toBe(false);
  mirror.removeDir('never-existed');
  expect(() => mirror.write('../outside.md', 'x')).toThrow('Refusing');
  expect(() => mirror.removeDir('')).toThrow('Refusing');
});
