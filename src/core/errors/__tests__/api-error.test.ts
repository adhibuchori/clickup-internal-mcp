import { expect, test } from 'bun:test';
import { ApiError } from '../api-error.ts';

test('carries status and ClickUp error code', () => {
  const error = new ApiError(401, 'OAUTH_017', 'Token invalid');
  expect(error).toBeInstanceOf(Error);
  expect([error.name, error.status, error.code, error.message]).toEqual([
    'ApiError',
    401,
    'OAUTH_017',
    'Token invalid',
  ]);
});
