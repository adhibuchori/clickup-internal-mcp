/**
 * How to register this server with each MCP client, as text to paste. Every client speaks the same
 * stdio protocol but stores its list of servers differently: `mcpServers` JSON (Claude Desktop,
 * Cursor, Windsurf, Gemini CLI), `servers` JSON with an explicit `"type": "stdio"` (VS Code), TOML
 * (Codex CLI), or a command (Claude Code). The token is never part of any of them: the server reads
 * it from its own .env, which also keeps it away from clients that filter or log their env blocks.
 * Commands are absolute paths, because GUI apps on macOS do not see the shell's PATH.
 */
export type ClientId =
  | 'claude-desktop'
  | 'claude-code'
  | 'cursor'
  | 'windsurf'
  | 'vscode'
  | 'gemini-cli'
  | 'codex-cli'
  | 'other';

export interface Launch {
  /** Absolute path of the executable: the compiled binary, or the Bun or Node runtime. */
  readonly command: string;
  readonly args: readonly string[];
}

export interface ClientConfig {
  readonly id: ClientId;
  readonly title: string;
  /** Where the snippet goes (macOS / Windows), or what to run. */
  readonly where: string;
  readonly snippet: string;
  readonly after: string;
}

export const SERVER_KEY = 'clickup-internal';

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** A TOML literal string: no escapes, so Windows backslashes stay as they are. */
function tomlString(value: string): string {
  return value.includes("'") ? JSON.stringify(value) : `'${value}'`;
}

function shellWord(value: string): string {
  return /^[\w./:\\-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`;
}

function standard(launch: Launch): string {
  return json({ mcpServers: { [SERVER_KEY]: { command: launch.command, args: launch.args } } });
}

type Builders = Partial<Record<ClientId, Omit<ClientConfig, 'id'>>>;

const RESTART = 'Restart the app, then ask it to "browse ClickUp".';

function appClients(launch: Launch): Builders {
  return {
    'claude-desktop': {
      title: 'Claude Desktop',
      where:
        'Settings → Developer → Edit Config (claude_desktop_config.json); merge into "mcpServers"',
      snippet: standard(launch),
      after: RESTART,
    },
    'claude-code': {
      title: 'Claude Code',
      where: 'Run in a terminal (user scope: every project)',
      snippet: `claude mcp add ${SERVER_KEY} --scope user -- ${[launch.command, ...launch.args].map(shellWord).join(' ')}`,
      after: 'Check with `claude mcp list`.',
    },
    cursor: {
      title: 'Cursor',
      where:
        '~/.cursor/mcp.json (Windows: %USERPROFILE%\\.cursor\\mcp.json); merge into "mcpServers"',
      snippet: standard(launch),
      after: 'Settings → MCP shows it with a green dot once it runs.',
    },
    windsurf: {
      title: 'Windsurf',
      where:
        '~/.codeium/windsurf/mcp_config.json (Windows: %USERPROFILE%\\.codeium\\windsurf\\mcp_config.json)',
      snippet: standard(launch),
      after: RESTART,
    },
  };
}

function toolClients(launch: Launch): Builders {
  return {
    vscode: {
      title: 'VS Code (Copilot Chat, agent mode)',
      where: 'Command Palette → "MCP: Open User Configuration" (mcp.json); merge into "servers"',
      snippet: json({
        servers: { [SERVER_KEY]: { type: 'stdio', command: launch.command, args: launch.args } },
      }),
      after: 'Start it from the mcp.json code lens, then pick its tools in agent mode.',
    },
    'gemini-cli': {
      title: 'Gemini CLI',
      where:
        '~/.gemini/settings.json (Windows: %USERPROFILE%\\.gemini\\settings.json); merge into "mcpServers"',
      snippet: standard(launch),
      after: 'Check with `/mcp` inside gemini.',
    },
    'codex-cli': {
      title: 'Codex CLI',
      where: '~/.codex/config.toml (Windows: %USERPROFILE%\\.codex\\config.toml)',
      snippet: [
        `[mcp_servers.${SERVER_KEY}]`,
        `command = ${tomlString(launch.command)}`,
        `args = [${launch.args.map(tomlString).join(', ')}]`,
      ].join('\n'),
      after: 'Check with `codex mcp list`.',
    },
    other: {
      title: 'Any other MCP client with stdio support',
      where: 'Add a stdio server with this command and arguments',
      snippet: `command: ${launch.command}\nargs:    ${json(launch.args)}`,
      after: 'No environment variables are needed: the server reads its own .env.',
    },
  };
}

function builders(launch: Launch): Builders {
  return { ...appClients(launch), ...toolClients(launch) };
}

export const CLIENT_IDS: readonly ClientId[] = [
  'claude-desktop',
  'claude-code',
  'cursor',
  'windsurf',
  'vscode',
  'gemini-cli',
  'codex-cli',
  'other',
];

export function clientConfigs(
  launch: Launch,
  only: readonly ClientId[] = CLIENT_IDS,
): ClientConfig[] {
  const all = builders(launch);
  return only.flatMap((id) => {
    const config = all[id];
    return config ? [{ id, ...config }] : [];
  });
}

export function isClientId(value: string): value is ClientId {
  return (CLIENT_IDS as readonly string[]).includes(value);
}

/**
 * The command a client should run: the executable itself when this is a compiled binary, or the
 * runtime (Bun or Node) with the entry file when it runs from a checkout.
 */
export function launchFor(execPath: string, entry: string): Launch {
  const runtime = /^(bun|node)(\.exe)?$/i.test(execPath.split(/[\\/]/).at(-1) ?? '');
  return runtime ? { command: execPath, args: [entry] } : { command: execPath, args: [] };
}

/** The whole setup guide as text: where the token goes, then one block per client. */
export function setupGuide(
  launch: Launch,
  envFiles: readonly string[],
  only: readonly ClientId[] = CLIENT_IDS,
): string {
  const doctor = [launch.command, ...launch.args, 'doctor'].map(shellWord).join(' ');
  const blocks = clientConfigs(launch, only).map((c) =>
    [
      `── ${c.title}`,
      `   ${c.where}`,
      '',
      c.snippet.replace(/^/gm, '   '),
      '',
      `   ${c.after}`,
    ].join('\n'),
  );
  return [
    'Before any client: put your token and workspace id in one of these files (see .env.example):',
    ...envFiles.map((file) => `   ${file}`),
    `Then check the setup:  ${doctor}`,
    '',
    ...blocks.flatMap((block) => [block, '']),
  ].join('\n');
}
