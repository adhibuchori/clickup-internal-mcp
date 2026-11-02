import { expect, test } from 'bun:test';
import { parseSettings } from '../settings.ts';

const platform = {
  platform: 'darwin',
  home: '/Users/me',
  localAppData: '',
  xdgDataHome: '',
  timeZone: 'Asia/Jakarta',
};
const token = ['pk', '7', 'Z'.repeat(32)].join('_');

test('defaults fill everything but the token and the workspace', () => {
  expect(
    parseSettings({ CLICKUP_API_TOKEN: token, CLICKUP_WORKSPACE_ID: '9001' }, platform),
  ).toEqual({
    token,
    workspaceId: '9001',
    dataDir: '/Users/me/Library/Application Support/clickup-internal-mcp',
    mirrorDir: null,
    ttlDays: 30,
    maxConcurrency: 8,
    maxRpm: 300,
    assetHosts: [],
    timeZone: 'Asia/Jakarta',
    logLevel: 'info',
  });
});

test('every setting can be changed', () => {
  const settings = parseSettings(
    {
      CLICKUP_API_TOKEN: token,
      CLICKUP_WORKSPACE_ID: '1',
      CLICKUP_DATA_DIR: '/d',
      CLICKUP_MIRROR_DIR: '/m',
      CLICKUP_CACHE_TTL_DAYS: '7',
      CLICKUP_MAX_CONCURRENCY: '2',
      CLICKUP_MAX_RPM: '60',
      CLICKUP_ASSET_HOSTS: ' cdn.example.com , ,x.io',
      CLICKUP_TIMEZONE: 'UTC',
      LOG_LEVEL: 'debug',
    },
    platform,
  );
  expect(settings).toMatchObject({
    dataDir: '/d',
    mirrorDir: '/m',
    ttlDays: 7,
    maxConcurrency: 2,
    maxRpm: 60,
    assetHosts: ['cdn.example.com', 'x.io'],
    timeZone: 'UTC',
    logLevel: 'debug',
  });
});

test('problems are listed by name and the token is never echoed', () => {
  let message = '';
  try {
    parseSettings(
      { CLICKUP_API_TOKEN: '', CLICKUP_WORKSPACE_ID: 'abc', CLICKUP_MAX_RPM: '1' },
      platform,
    );
  } catch (error) {
    message = error instanceof Error ? error.message : '';
  }
  expect(message).toContain('CLICKUP_API_TOKEN is missing');
  expect(message).toContain('CLICKUP_WORKSPACE_ID must be the number');
  expect(message).toContain('CLICKUP_MAX_RPM');
  expect(() =>
    parseSettings(
      { CLICKUP_API_TOKEN: token, CLICKUP_WORKSPACE_ID: '1', CLICKUP_TIMEZONE: 'Mars/Base' },
      platform,
    ),
  ).toThrow('CLICKUP_TIMEZONE');
  try {
    parseSettings({ CLICKUP_API_TOKEN: token, CLICKUP_WORKSPACE_ID: 'x' }, platform);
  } catch (error) {
    expect(error instanceof Error ? error.message : '').not.toContain(token);
  }
});
