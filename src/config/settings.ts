/**
 * Every setting the server reads, validated once. Values come from the environment first, then
 * from a .env file; src/env.ts gathers both and hands them here as plain strings. The token is
 * checked for presence and shape only and never appears in an error message.
 */
import { z } from 'zod';
import { defaultDataDir, type DataDirInput } from '../core/paths/data-dir.ts';

const schema = z.object({
  CLICKUP_API_TOKEN: z
    .string()
    .trim()
    .min(1, 'is missing: create a personal token in ClickUp → Settings → Apps'),
  CLICKUP_WORKSPACE_ID: z
    .string()
    .trim()
    .regex(/^\d+$/, 'must be the number after the host in a ClickUp URL'),
  CLICKUP_DATA_DIR: z.string().trim().default(''),
  CLICKUP_MIRROR_DIR: z.string().trim().default(''),
  CLICKUP_CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(3650).default(30),
  CLICKUP_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(8),
  CLICKUP_MAX_RPM: z.coerce.number().int().min(10).max(5000).default(300),
  CLICKUP_ASSET_HOSTS: z.string().default(''),
  CLICKUP_TIMEZONE: z.string().trim().default(''),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Settings {
  readonly token: string;
  readonly workspaceId: string;
  readonly dataDir: string;
  readonly mirrorDir: string | null;
  readonly ttlDays: number;
  readonly maxConcurrency: number;
  readonly maxRpm: number;
  readonly assetHosts: readonly string[];
  readonly timeZone: string;
  readonly logLevel: LogLevel;
}

function validZone(zone: string): boolean {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone.length > 0
    );
  } catch {
    return false;
  }
}

/** Throws an Error naming each bad setting; values are never echoed. */
export function parseSettings(
  values: Readonly<Record<string, string>>,
  platform: DataDirInput & { timeZone: string },
): Settings {
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `- ${issue.path.join('.')} ${issue.message}`,
    );
    throw new Error(
      `clickup-internal-mcp is not configured:\n${problems.join('\n')}\nSee .env.example.`,
    );
  }
  const v = parsed.data;
  const zone = v.CLICKUP_TIMEZONE || platform.timeZone;
  if (!validZone(zone))
    throw new Error(
      `clickup-internal-mcp is not configured:\n- CLICKUP_TIMEZONE is not a known time zone.`,
    );
  return {
    token: v.CLICKUP_API_TOKEN,
    workspaceId: v.CLICKUP_WORKSPACE_ID,
    dataDir: v.CLICKUP_DATA_DIR || defaultDataDir(platform),
    mirrorDir: v.CLICKUP_MIRROR_DIR || null,
    ttlDays: v.CLICKUP_CACHE_TTL_DAYS,
    maxConcurrency: v.CLICKUP_MAX_CONCURRENCY,
    maxRpm: v.CLICKUP_MAX_RPM,
    assetHosts: v.CLICKUP_ASSET_HOSTS.split(',')
      .map((h) => h.trim())
      .filter(Boolean),
    timeZone: zone,
    logLevel: v.LOG_LEVEL,
  };
}
