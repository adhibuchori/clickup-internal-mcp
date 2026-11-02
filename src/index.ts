#!/usr/bin/env bun
/**
 * Command line entry. No argument (or `stdio`) runs the MCP server on stdin/stdout for Claude Code
 * or Claude Desktop. `doctor` checks the setup; `purge --yes` deletes the local cache. stdout
 * belongs to the MCP protocol in server mode, so everything else goes to stderr.
 */
import { rmSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import packageJson from '../package.json' with { type: 'json' };
import { loadSqlite } from './adapters/store/sqlite.ts';
import { createRuntime, type Runtime } from './composition/create-runtime.ts';
import type { Settings } from './config/settings.ts';
import { runDoctor } from './engine/doctor/doctor.ts';
import { loadSettings } from './env.ts';
import { buildMcpServer } from './tools/registry/build-server.ts';

const say = (line: string): void => void process.stderr.write(`${line}\n`);

async function runtime(settings: Settings): Promise<Runtime> {
  return createRuntime({
    settings,
    fetch: (url, init) => fetch(url, init),
    openSqlite: await loadSqlite(),
  });
}

async function serve(settings: Settings): Promise<void> {
  const rt = await runtime(settings);
  const server = buildMcpServer(rt.context, packageJson.version);
  const stop = async (): Promise<void> => {
    await server.close();
    rt.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
  process.stdin.on('end', () => void stop());
  await server.connect(new StdioServerTransport());
  rt.deps.logger.info('ready', {
    version: packageJson.version,
    workspace: settings.workspaceId,
    tracked: rt.deps.stores.tracked.list().length,
  });
}

async function doctor(settings: Settings): Promise<void> {
  const rt = await runtime({ ...settings, logLevel: 'error' });
  const checks = await runDoctor(rt.deps, {
    tokenTail: settings.token.slice(-4),
    dataDir: settings.dataDir,
    mirrorDir: settings.mirrorDir,
  });
  rt.close();
  for (const c of checks) say(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.label.padEnd(10)} ${c.detail}`);
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
}

function purge(settings: Settings, args: readonly string[]): void {
  if (!args.includes('--yes')) {
    say(
      `This deletes the local cache at ${settings.dataDir} (tracked list, docs, tasks, images, notes).`,
    );
    say('Run again with --yes to confirm. ClickUp itself is not touched.');
    process.exitCode = 1;
    return;
  }
  rmSync(settings.dataDir, { recursive: true, force: true });
  say(`Deleted ${settings.dataDir}.`);
}

async function main(): Promise<void> {
  const [command = 'stdio', ...args] = process.argv.slice(2);
  const settings = loadSettings();
  if (command === 'doctor') return doctor(settings);
  if (command === 'purge') return purge(settings, args);
  if (command === 'stdio') return serve(settings);
  say(`Unknown command "${command}". Use: stdio (default), doctor, purge --yes`);
  process.exitCode = 2;
}

try {
  await main();
} catch (error) {
  say(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
