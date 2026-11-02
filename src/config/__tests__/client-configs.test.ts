import { expect, test } from 'bun:test';
import {
  CLIENT_IDS,
  clientConfigs,
  isClientId,
  launchFor,
  SERVER_KEY,
  setupGuide,
} from '../client-configs.ts';

const mac = {
  command: '/Users/me/.bun/bin/bun',
  args: ['/Users/me/clickup internal/src/index.ts'],
};
const win = { command: 'C:\\Tools\\clickup-internal-mcp-windows-x64.exe', args: [] };

const snippet = (id: (typeof CLIENT_IDS)[number], launch = mac): string =>
  clientConfigs(launch, [id])[0]?.snippet ?? '';

test('JSON clients get valid JSON under the key they read, with absolute commands', () => {
  for (const id of ['claude-desktop', 'cursor', 'windsurf', 'gemini-cli'] as const) {
    const parsed: unknown = JSON.parse(snippet(id));
    expect(parsed).toEqual({
      mcpServers: { [SERVER_KEY]: { command: mac.command, args: mac.args } },
    });
  }
  expect(JSON.parse(snippet('vscode'))).toEqual({
    servers: { [SERVER_KEY]: { type: 'stdio', command: mac.command, args: mac.args } },
  });
  expect(JSON.parse(snippet('cursor', win))).toEqual({
    mcpServers: { [SERVER_KEY]: { command: win.command, args: [] } },
  });
});

test('Codex gets TOML with literal strings, so Windows paths keep their backslashes', () => {
  expect(snippet('codex-cli', win)).toBe(
    `[mcp_servers.${SERVER_KEY}]\ncommand = 'C:\\Tools\\clickup-internal-mcp-windows-x64.exe'\nargs = []`,
  );
  expect(snippet('codex-cli')).toContain("args = ['/Users/me/clickup internal/src/index.ts']");
  expect(snippet('codex-cli', { command: "/it's/bun", args: [] })).toContain(
    'command = "/it\'s/bun"',
  );
});

test('Claude Code gets a command with paths quoted only when needed', () => {
  expect(snippet('claude-code')).toBe(
    `claude mcp add ${SERVER_KEY} --scope user -- /Users/me/.bun/bin/bun "/Users/me/clickup internal/src/index.ts"`,
  );
  expect(snippet('claude-code', win)).toBe(
    `claude mcp add ${SERVER_KEY} --scope user -- C:\\Tools\\clickup-internal-mcp-windows-x64.exe`,
  );
});

test('every client has a title, a place and a next step; no snippet carries a token', () => {
  const all = clientConfigs(mac);
  expect(all.map((c) => c.id)).toEqual([...CLIENT_IDS]);
  for (const config of all) {
    expect(config.title && config.where && config.after).toBeTruthy();
    expect(config.snippet).not.toMatch(/TOKEN|pk_/);
  }
  expect(isClientId('cursor')).toBe(true);
  expect(isClientId('notepad')).toBe(false);
});

test('launchFor runs a compiled binary as is, and a checkout through its runtime', () => {
  expect(launchFor('/usr/local/bin/bun', '/x/src/index.ts')).toEqual({
    command: '/usr/local/bin/bun',
    args: ['/x/src/index.ts'],
  });
  expect(launchFor('C:\\Program Files\\nodejs\\node.exe', 'C:\\x\\index.ts').args).toEqual([
    'C:\\x\\index.ts',
  ]);
  expect(
    launchFor('C:\\Tools\\clickup-internal-mcp-windows-x64.exe', 'B:/~BUN/root/index.ts'),
  ).toEqual({
    command: 'C:\\Tools\\clickup-internal-mcp-windows-x64.exe',
    args: [],
  });
});

test('setupGuide lists the env files, the doctor command and the chosen clients', () => {
  const guide = setupGuide(
    win,
    ['C:\\Tools\\.env', 'C:\\Tools\\clickup-internal-mcp.env'],
    ['cursor'],
  );
  expect(guide).toContain('   C:\\Tools\\clickup-internal-mcp.env');
  expect(guide).toContain(
    'Then check the setup:  C:\\Tools\\clickup-internal-mcp-windows-x64.exe doctor',
  );
  expect(guide).toContain('── Cursor');
  expect(guide).not.toContain('── VS Code');
  expect(setupGuide(mac, [])).toContain('── Codex CLI');
});
