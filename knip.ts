import type { KnipConfig } from 'knip';

/**
 * Dead-code gate (`bun run check:dead-code`). The server entry is found through package.json; the
 * entries below are run by path from package.json scripts and .claude/settings.json.
 */
const config: KnipConfig = {
  entry: ['scripts/**/*.ts', '.claude/hooks/*.ts'],
  project: ['src/**/*.ts', 'scripts/**/*.ts', '.claude/hooks/*.ts'],
  ignoreExportsUsedInFile: false,
};

export default config;
