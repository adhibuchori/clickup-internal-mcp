/**
 * Image files under <data dir>/assets, named by content hash. Names are validated before they touch
 * the file system, so nothing can escape the folder.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AssetFiles } from '../../ports/files.ts';

const NAME = /^[0-9a-f]{64}\.[a-z0-9]{1,5}$/;

function checked(dir: string, name: string): string {
  if (!NAME.test(name)) throw new Error(`Refusing asset file name "${name}".`);
  return join(dir, name);
}

export function createAssetFiles(dir: string): AssetFiles {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return {
    write: (name, bytes) => writeFileSync(checked(dir, name), bytes, { mode: 0o600 }),
    read(name) {
      try {
        return new Uint8Array(readFileSync(checked(dir, name)));
      } catch {
        return null;
      }
    },
    remove: (name) => rmSync(checked(dir, name), { force: true }),
  };
}
