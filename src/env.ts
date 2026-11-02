/**
 * The only file in src/ that reads process.env (AGENTS.md Rule 22). Values come from the
 * environment, then from the first settings file found (`envFileCandidates`). The environment wins
 * over the file. Next to a compiled executable, `clickup-internal-mcp.env` works as well as `.env`,
 * because a file named only ".env" is awkward to create in Windows Explorer.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseDotEnv } from './config/dotenv.ts';
import { parseSettings, type Settings } from './config/settings.ts';
import { defaultDataDir } from './core/paths/data-dir.ts';

function definedOnly(source: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

const PROJECT_DIR = join(import.meta.dirname, '..');

function platformInfo(environment: Record<string, string>) {
  return {
    platform: process.platform,
    home: homedir(),
    localAppData: environment['LOCALAPPDATA'] ?? '',
    xdgDataHome: environment['XDG_DATA_HOME'] ?? '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/** The settings files worth naming to a person: beside the executable, or in the checkout. */
export function suggestedEnvFiles(compiled: boolean): string[] {
  const beside = dirname(process.execPath);
  return compiled
    ? [join(beside, 'clickup-internal-mcp.env'), join(beside, '.env')]
    : [join(PROJECT_DIR, '.env')];
}

/** Where settings files are looked for, in order. */
function envFileCandidates(): string[] {
  const environment = definedOnly(process.env);
  const dataDir = environment['CLICKUP_DATA_DIR'] || defaultDataDir(platformInfo(environment));
  const beside = dirname(process.execPath);
  return [
    environment['CLICKUP_ENV_FILE'] ?? '',
    join(PROJECT_DIR, '.env'),
    join(beside, '.env'),
    join(beside, 'clickup-internal-mcp.env'),
    join(dataDir, '.env'),
  ].filter(Boolean);
}

export function loadSettings(): Settings {
  const environment = definedOnly(process.env);
  const file = envFileCandidates().find((path) => existsSync(path));
  const fromFile = file ? Object.fromEntries(parseDotEnv(readFileSync(file, 'utf8'))) : {};
  return parseSettings({ ...fromFile, ...environment }, platformInfo(environment));
}
