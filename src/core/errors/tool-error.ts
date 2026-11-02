/**
 * The one error shape tools report back to the model: a message it can act on, plus a hint for the
 * next call. Anything else is an internal error, reported without paths or stacks.
 */
export class ToolError extends Error {
  readonly hint: string;

  constructor(message: string, hint = '') {
    super(message);
    this.name = 'ToolError';
    this.hint = hint;
  }
}

const INTERNAL = 'Internal error while running the tool. The server log has the details.';

/** Text for the model. A ToolError keeps its message and hint; any other error stays generic. */
export function describeError(error: unknown): string {
  if (!(error instanceof ToolError)) return INTERNAL;
  return error.hint ? `${error.message}\nHint: ${error.hint}` : error.message;
}
