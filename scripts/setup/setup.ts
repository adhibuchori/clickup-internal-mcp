#!/usr/bin/env bun
/**
 * `bun run setup`: the same guide as `<executable> setup`, for a checkout. Prints how to register
 * this server with each MCP client; writes nothing. For a compiled executable, run the executable
 * itself with `setup` instead, so the paths are its own.
 *
 *   bun run setup
 *   bun run setup -- --client cursor --client vscode
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const entry = resolve(import.meta.dirname, '..', '..', 'src', 'index.ts');
const result = spawnSync(process.execPath, [entry, 'setup', ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
