/**
 * `bun run doctor`: checks the setup end to end without printing anything secret. The token is shown
 * only as a fingerprint (its last four characters); every check says what to do when it fails.
 */
import type { EngineDeps } from '../deps/engine-deps.types.ts';

export interface DoctorCheck {
  readonly ok: boolean;
  readonly label: string;
  readonly detail: string;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

async function check(
  label: string,
  work: () => Promise<string>,
  fix: string,
): Promise<DoctorCheck> {
  try {
    return { ok: true, label, detail: await work() };
  } catch (error) {
    return { ok: false, label, detail: `${reason(error)}. ${fix}` };
  }
}

export async function runDoctor(
  deps: EngineDeps,
  info: { tokenTail: string; dataDir: string; mirrorDir: string | null },
): Promise<DoctorCheck[]> {
  const user = await check(
    'Token',
    async () => {
      const me = await deps.clickup.me();
      return `accepted for ${me.username} (token …${info.tokenTail})`;
    },
    'Create a new personal token in ClickUp → Settings → Apps and put it in .env as CLICKUP_API_TOKEN.',
  );
  const spaces = user.ok
    ? await check(
        'Workspace',
        async () =>
          `workspace ${deps.config.workspaceId} reachable, ${(await deps.clickup.spaces()).length} spaces visible`,
        'Check CLICKUP_WORKSPACE_ID: the number right after the host in a ClickUp URL.',
      )
    : { ok: false, label: 'Workspace', detail: 'skipped: the token check failed' };
  return [
    user,
    spaces,
    {
      ok: true,
      label: 'Cache',
      detail: `${info.dataDir} (${deps.stores.tracked.list().length} tracked)`,
    },
    {
      ok: true,
      label: 'Mirror',
      detail: info.mirrorDir ?? 'off (set CLICKUP_MIRROR_DIR to write Markdown files)',
    },
    { ok: true, label: 'Time zone', detail: deps.config.timeZone },
  ];
}
