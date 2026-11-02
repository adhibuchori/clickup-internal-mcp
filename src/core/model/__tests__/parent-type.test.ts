import { expect, test } from 'bun:test';
import { PARENT_TYPE } from '../parent-type.ts';

test('matches the API v3 parent type codes', () => {
  expect(PARENT_TYPE).toEqual({ space: 4, folder: 5, list: 6, everything: 7, workspace: 12 });
});
