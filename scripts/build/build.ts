#!/usr/bin/env bun
/**
 * Builds single-file executables with `bun build --compile`, so teammates need neither Bun nor
 * Node. Output: dist/clickup-internal-mcp-<target>[.exe]. Builds every target, or the ones named:
 *
 *   bun run build
 *   bun run build -- darwin-arm64 windows-x64
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const TARGETS = ['darwin-arm64', 'darwin-x64', 'windows-x64', 'linux-x64'];
const root = resolve(import.meta.dirname, '..', '..');
const wanted = process.argv.slice(2).filter((a) => TARGETS.includes(a));

for (const target of wanted.length > 0 ? wanted : TARGETS) {
  const out = resolve(
    root,
    'dist',
    `clickup-internal-mcp-${target}${target.startsWith('windows') ? '.exe' : ''}`,
  );
  const result = spawnSync(
    process.execPath,
    [
      'build',
      '--compile',
      '--minify',
      `--target=bun-${target}`,
      resolve(root, 'src', 'index.ts'),
      '--outfile',
      out,
    ],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(`built ${out}`);
}
