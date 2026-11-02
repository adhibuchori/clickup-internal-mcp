#!/usr/bin/env bun
/**
 * Command line entry. No argument (or `stdio`) runs the MCP server on stdin/stdout for any MCP
 * client. `setup [--client <id>]` prints how to register it with each client, `doctor` checks the
 * setup, `version` prints the version, `purge --yes` deletes the local cache. stdout belongs to the MCP protocol in server mode,
 * so everything else goes to stderr.
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import packageJson from '../package.json' with { type: 'json' };
import { loadSqlite } from './adapters/store/sqlite.ts';
import { createRuntime, type Runtime } from './composition/create-runtime.ts';
import type { Settings } from './config/settings.ts';
import { runDoctor } from './engine/doctor/doctor.ts';
import { loadSettings, suggestedEnvFiles } from './env.ts';
import { CLIENT_IDS, isClientId, launchFor, setupGuide } from './config/client-configs.ts';
import { buildMcpServer } from './tools/registry/build-server.ts';

/** Errors and the server's own notes: stderr, because stdout carries the protocol in server mode. */
const say = (line: string): void => void process.stderr.write(`${line}\n`);
/** Output of the one-shot commands (setup, version, doctor, purge): stdout, so it can be piped. */
const print = (line: string): void => void process.stdout.write(`${line}\n`);

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
  print(`clickup-internal-mcp ${packageJson.version}`);
  for (const c of checks) print(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.label.padEnd(10)} ${c.detail}`);
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
}

function purge(settings: Settings, args: readonly string[]): void {
  if (!args.includes('--yes')) {
    print(
      `This deletes the local cache at ${settings.dataDir} (tracked list, docs, tasks, images, notes).`,
    );
    print('Run again with --yes to confirm. ClickUp itself is not touched.');
    process.exitCode = 1;
    return;
  }
  rmSync(settings.dataDir, { recursive: true, force: true });
  print(`Deleted ${settings.dataDir}.`);
}

function setup(args: readonly string[]): void {
  const wanted = args.flatMap((arg, i) =>
    arg === '--client' && args[i + 1] ? [args[i + 1] ?? ''] : [],
  );
  const unknown = wanted.filter((id) => !isClientId(id));
  if (unknown.length > 0) {
    say(`Unknown client: ${unknown.join(', ')}. Choose from: ${CLIENT_IDS.join(', ')}`);
    process.exitCode = 2;
    return;
  }
  const launch = launchFor(process.execPath, join(import.meta.dirname, 'index.ts'));
  const only = wanted.filter(isClientId);
  print(
    setupGuide(
      launch,
      suggestedEnvFiles(launch.args.length === 0),
      only.length > 0 ? only : CLIENT_IDS,
    ),
  );
}

async function main(): Promise<void> {
  const [command = 'stdio', ...args] = process.argv.slice(2);
  if (command === 'setup') return setup(args);
  if (command === 'version' || command === '--version') return print(packageJson.version);
  const settings = loadSettings();
  if (command === 'doctor') return doctor(settings);
  if (command === 'purge') return purge(settings, args);
  if (command === 'stdio') return serve(settings);
  say(`Unknown command "${command}". Use: stdio (default), setup, doctor, version, purge --yes`);
  process.exitCode = 2;
}

try {
  await main();
} catch (error) {
  say(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
