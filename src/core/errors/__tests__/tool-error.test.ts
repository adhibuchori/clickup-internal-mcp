import { expect, test } from 'bun:test';
import { describeError, ToolError } from '../tool-error.ts';

test('a ToolError keeps its message and hint', () => {
  const error = new ToolError('Unknown task "x".', 'Call list_tasks.');
  expect(error.name).toBe('ToolError');
  expect(describeError(error)).toBe('Unknown task "x".\nHint: Call list_tasks.');
  expect(describeError(new ToolError('Plain.'))).toBe('Plain.');
});

test('any other error stays generic, so paths and stacks never leak', () => {
  expect(describeError(new Error('ENOENT: /Users/me/secret'))).toBe(
    'Internal error while running the tool. The server log has the details.',
  );
  expect(describeError('boom')).toContain('Internal error');
});
