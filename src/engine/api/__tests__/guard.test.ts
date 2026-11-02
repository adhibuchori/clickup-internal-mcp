import { expect, test } from 'bun:test';
import { ApiError } from '../../../core/errors/api-error.ts';
import { describeError, ToolError } from '../../../core/errors/tool-error.ts';
import { guard, isTransient } from '../guard.ts';

const failWith = async (error: unknown): Promise<string> => {
  try {
    await guard('task', async () => {
      throw error;
    });
    return '';
  } catch (caught) {
    return describeError(caught);
  }
};

test('every ClickUp refusal becomes a ToolError with a next step', async () => {
  expect(await failWith(new ApiError(0, 'NETWORK', 'ClickUp could not be reached.'))).toContain(
    'VPN',
  );
  expect(await failWith(new ApiError(401, '', 'x'))).toContain('rejected the token');
  expect(await failWith(new ApiError(403, '', 'x'))).toContain('cannot open this task');
  expect(await failWith(new ApiError(403, 'HOST_NOT_ALLOWED', 'Host refused.'))).toContain(
    'Host refused.',
  );
  expect(await failWith(new ApiError(404, '', 'x'))).toContain('No task with that id');
  expect(await failWith(new ApiError(413, 'TOO_LARGE', 'Too big.'))).toContain(
    'Open it in ClickUp',
  );
  expect(await failWith(new ApiError(429, '', 'x'))).toContain('rate limiting');
  expect(await failWith(new ApiError(500, '', 'x'))).toBe(
    'ClickUp could not return the task (500).\nHint: Try again in a moment.',
  );
});

test('other errors pass through untouched; success passes the value', async () => {
  const plain = new Error('bug');
  expect(
    await guard('x', async () => {
      throw plain;
    }).catch((error: unknown) => error),
  ).toBe(plain);
  expect(
    await guard('x', async () => {
      throw new ToolError('mine');
    }).catch((error: unknown) => error),
  ).toMatchObject({ message: 'mine' });
  expect(await guard('x', async () => 5)).toBe(5);
});

test('isTransient: network, rate limit and server errors only', () => {
  expect([0, 429, 500, 503].map((s) => isTransient(new ApiError(s, '', '')))).toEqual([
    true,
    true,
    true,
    true,
  ]);
  expect([401, 403, 404].map((s) => isTransient(new ApiError(s, '', '')))).toEqual([
    false,
    false,
    false,
  ]);
  expect(isTransient(new Error('x'))).toBe(false);
});
