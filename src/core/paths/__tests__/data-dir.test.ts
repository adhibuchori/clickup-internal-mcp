import { expect, test } from 'bun:test';
import { defaultDataDir } from '../data-dir.ts';

const base = { home: '/Users/me', localAppData: '', xdgDataHome: '' };

test('per OS application data folders', () => {
  expect(defaultDataDir({ ...base, platform: 'darwin' })).toBe(
    '/Users/me/Library/Application Support/clickup-internal-mcp',
  );
  expect(defaultDataDir({ ...base, platform: 'linux' })).toBe(
    '/Users/me/.local/share/clickup-internal-mcp',
  );
  expect(defaultDataDir({ ...base, platform: 'linux', xdgDataHome: '/data' })).toBe(
    '/data/clickup-internal-mcp',
  );
  expect(
    defaultDataDir({
      platform: 'win32',
      home: 'C:\\Users\\me',
      localAppData: 'C:\\Users\\me\\AppData\\Local',
      xdgDataHome: '',
    }),
  ).toBe('C:\\Users\\me\\AppData\\Local\\clickup-internal-mcp');
  expect(
    defaultDataDir({ platform: 'win32', home: 'C:\\Users\\me', localAppData: '', xdgDataHome: '' }),
  ).toBe('C:\\Users\\me\\AppData\\Local\\clickup-internal-mcp');
});
