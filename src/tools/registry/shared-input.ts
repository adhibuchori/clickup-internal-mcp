/** Input fields several tools share, with one description each so the model reads them the same way. */
import { z } from 'zod';

export const cursorField = z
  .string()
  .max(200)
  .optional()
  .describe('Cursor from a previous answer, to get the next part of the same request.');

export const freshField = z
  .boolean()
  .default(false)
  .describe('Fetch from ClickUp now even when a recent copy exists.');

export const limitField = (fallback: number, max: number) =>
  z
    .number()
    .int()
    .min(1)
    .max(max)
    .default(fallback)
    .describe(`How many results to show (default ${fallback}, at most ${max}).`);
