import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssetFiles } from '../asset-files.ts';

const dir = mkdtempSync(join(tmpdir(), 'assets-'));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test('writes, reads and removes files named by hash, and refuses any other name', () => {
  const files = createAssetFiles(join(dir, 'assets'));
  const name = `${'a'.repeat(64)}.png`;
  files.write(name, new Uint8Array([1, 2]));
  expect(files.read(name)).toEqual(new Uint8Array([1, 2]));
  /* Windows has no POSIX permission bits; the mode is only meaningful elsewhere. */
  if (process.platform !== 'win32')
    expect(statSync(join(dir, 'assets', name)).mode & 0o777).toBe(0o600);
  files.remove(name);
  expect(files.read(name)).toBeNull();
  expect(() => files.write('../escape.png', new Uint8Array())).toThrow('Refusing');
  expect(files.read('../../etc/passwd')).toBeNull();
});
