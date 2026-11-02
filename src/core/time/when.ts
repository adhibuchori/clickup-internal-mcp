/**
 * Points in time as people type them: "7d", "24h", "2w" (ago), or a calendar date "2026-11-01",
 * which means the start of that day in the user's time zone, not in UTC.
 */
import { ToolError } from '../errors/tool-error.ts';

const UNIT: Readonly<Record<string, number>> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

export interface CalendarDay {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Milliseconds between UTC and the zone at a given instant (positive east of Greenwich). */
function zoneOffset(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(ms);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Midnight at the start of the calendar day in the zone. */
export function startOfDay(date: CalendarDay, timeZone: string): number {
  const guess = Date.UTC(date.year, date.month - 1, date.day);
  return guess - zoneOffset(guess - zoneOffset(guess, timeZone), timeZone);
}

function relative(text: string, now: number): number | null {
  const match = /^(\d{1,4})\s*([mhdw])$/.exec(text);
  const unit = match?.[2] ? UNIT[match[2]] : undefined;
  return match?.[1] && unit ? now - Number(match[1]) * unit : null;
}

function calendar(text: string, timeZone: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const valid = date.month >= 1 && date.month <= 12 && date.day >= 1 && date.day <= 31;
  return valid ? startOfDay(date, timeZone) : null;
}

export function parseWhen(input: string, now: number, timeZone: string): number {
  const text = input.trim().toLowerCase();
  const ms = relative(text, now) ?? calendar(text, timeZone);
  if (ms !== null) return ms;
  throw new ToolError(
    `"${input.slice(0, 40)}" is not a time this tool understands.`,
    'Use "7d", "24h", "2w" or a date like "2026-11-01".',
  );
}
