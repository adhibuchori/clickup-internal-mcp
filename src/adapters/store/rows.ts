/**
 * Typed reads from SQLite rows, so no query result is ever asserted into a type. JSON columns are
 * parsed through a zod schema: a row written by an older build that no longer fits reads as null and
 * is fetched again, instead of crashing a tool.
 */
import type { z } from 'zod';
import type { SqlDb, SqlRow } from './sqlite.ts';

export function text(row: SqlRow | undefined, key: string): string {
  const value = row?.[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return '';
}

export function int(row: SqlRow | undefined, key: string): number {
  const value = row?.[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return typeof value === 'string' && value !== '' ? Number(value) : 0;
}

export function intOrNull(row: SqlRow | undefined, key: string): number | null {
  const value = row?.[key];
  return value === null || value === undefined ? null : int(row, key);
}

export function textOrNull(row: SqlRow | undefined, key: string): string | null {
  const value = row?.[key];
  return value === null || value === undefined ? null : text(row, key);
}

export function parseJson<S extends z.ZodType>(schema: S, value: string): z.output<S> | null {
  try {
    const parsed = schema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Runs `work` in one transaction: all of it lands, or none of it. */
export function transaction<T>(db: SqlDb, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
