/**
 * Where the cache lives when CLICKUP_DATA_DIR is not set: the per-user application data folder of
 * each OS, never the project folder (the cache holds company content and must not be committed).
 */
import { posix, win32 } from 'node:path';

export interface DataDirInput {
  readonly platform: string;
  readonly home: string;
  readonly localAppData: string;
  readonly xdgDataHome: string;
}

const NAME = 'clickup-internal-mcp';

export function defaultDataDir(input: DataDirInput): string {
  if (input.platform === 'win32')
    return win32.join(input.localAppData || win32.join(input.home, 'AppData', 'Local'), NAME);
  if (input.platform === 'darwin')
    return posix.join(input.home, 'Library', 'Application Support', NAME);
  return posix.join(input.xdgDataHome || posix.join(input.home, '.local', 'share'), NAME);
}
