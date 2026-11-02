/**
 * The only file in src/ that reads process.env (AGENTS.md Rule 22). Values come from the
 * environment, then from the first .env file found: CLICKUP_ENV_FILE, the project folder, the
 * folder of a compiled executable, then the data folder. The environment wins over the file.
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

export function loadSettings(): Settings {
  const environment = definedOnly(process.env);
  const platform = {
    platform: process.platform,
    home: homedir(),
    localAppData: environment['LOCALAPPDATA'] ?? '',
    xdgDataHome: environment['XDG_DATA_HOME'] ?? '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  const dataDir = environment['CLICKUP_DATA_DIR'] || defaultDataDir(platform);
  const candidates = [
    environment['CLICKUP_ENV_FILE'] ?? '',
    join(PROJECT_DIR, '.env'),
    join(dirname(process.execPath), '.env'),
    join(dataDir, '.env'),
  ].filter(Boolean);
  const file = candidates.find((path) => existsSync(path));
  const fromFile = file ? Object.fromEntries(parseDotEnv(readFileSync(file, 'utf8'))) : {};
  return parseSettings({ ...fromFile, ...environment }, platform);
}
