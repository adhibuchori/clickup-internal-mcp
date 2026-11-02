/**
 * The optional Markdown mirror: plain files under CLICKUP_MIRROR_DIR for reading and `git diff`
 * outside Claude. Paths come from the engine already slugged; this still refuses anything that
 * would leave the mirror folder.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import type { MirrorFiles } from '../../ports/files.ts';

function inside(root: string, path: string): string {
  const target = resolve(root, ...path.split('/'));
  const rel = relative(root, target);
  if (rel === '' || rel.startsWith('..') || resolve(root, rel) !== target)
    throw new Error(`Refusing mirror path "${path}".`);
  return target;
}

export function createMirrorFiles(dir: string): MirrorFiles {
  const root = resolve(dir);
  return {
    write(path, data) {
      const target = inside(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, data);
    },
    removeDir: (path) => rmSync(inside(root, path), { recursive: true, force: true }),
  };
}
