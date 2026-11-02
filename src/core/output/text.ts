/**
 * Small text helpers shared by every formatter: counts, dates in the user's time zone, relative
 * ages, and one-line clipping. Dates are rendered in a named zone because ClickUp stores a due date
 * as the local midnight of whoever set it: in UTC+7 that is the previous day in UTC.
 */
export function plural(count: number, noun: string): string {
  if (count === 1) return `1 ${noun}`;
  return `${count.toLocaleString('en-US')} ${noun}${/(s|sh|ch|x)$/.test(noun) ? 'es' : 's'}`;
}

function parts(ms: number, timeZone: string): Record<string, string> {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(format.formatToParts(ms).map((part) => [part.type, part.value]));
}

/** "2026-11-02" in the zone. */
export function formatDate(ms: number, timeZone: string): string {
  const p = parts(ms, timeZone);
  return `${p['year']}-${p['month']}-${p['day']}`;
}

/** "2026-11-02 14:05" in the zone. */
export function formatDateTime(ms: number, timeZone: string): string {
  const p = parts(ms, timeZone);
  return `${p['year']}-${p['month']}-${p['day']} ${p['hour']}:${p['minute']}`;
}

const STEPS: readonly [number, string][] = [
  [365 * 86_400_000, 'y'],
  [30 * 86_400_000, 'mo'],
  [7 * 86_400_000, 'w'],
  [86_400_000, 'd'],
  [3_600_000, 'h'],
  [60_000, 'm'],
];

/** "3d ago", "just now", or "in 2d" for a future time. */
export function ago(ms: number, now: number): string {
  const delta = now - ms;
  const size = Math.abs(delta);
  const step = STEPS.find(([unit]) => size >= unit);
  if (!step) return 'just now';
  const amount = `${Math.floor(size / step[0])}${step[1]}`;
  return delta >= 0 ? `${amount} ago` : `in ${amount}`;
}

/** One line, at most `max` characters, whitespace collapsed. */
export function clip(text: string, max: number): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length <= max ? line : `${line.slice(0, Math.max(1, max - 1))}…`;
}
