#!/usr/bin/env bun
/**
 * Prints how to register this server with Claude Code and Claude Desktop, for this checkout or a
 * compiled binary. It writes nothing: copy the command or the JSON yourself. The token stays in
 * .env and is never part of either.
 *
 *   bun run setup                 # for this checkout (bun src/index.ts)
 *   bun run setup -- --binary P   # for a compiled executable at path P
 */
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const binaryArg = process.argv.indexOf('--binary');
const binary = binaryArg > 0 ? resolve(process.argv[binaryArg + 1] ?? '') : null;
const command = binary ?? 'bun';
const args = binary ? [] : [join(root, 'src', 'index.ts')];

console.log('1. Put your token in .env (see .env.example), then check it:');
console.log(binary ? `   ${binary} doctor` : '   bun run doctor');
console.log('\n2. Claude Code (user scope, every project):');
console.log(
  `   claude mcp add clickup-internal --scope user -- ${[command, ...args].map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`,
);
console.log('\n3. Claude Desktop: add this to claude_desktop_config.json under "mcpServers":');
console.log(
  JSON.stringify({ 'clickup-internal': { command, args } }, null, 2).replace(/^/gm, '   '),
);
console.log('\nA compiled binary reads .env from its own folder, or set CLICKUP_ENV_FILE.');
