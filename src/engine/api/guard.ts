/**
 * ClickUp refusals in words the model can act on. Every engine call to the API goes through
 * `guard`, which turns an ApiError into a ToolError with a next step; anything else passes through
 * and ends up as a logged internal error.
 */
import { ApiError } from '../../core/errors/api-error.ts';
import { ToolError } from '../../core/errors/tool-error.ts';

function explain(error: ApiError, what: string): ToolError {
  switch (error.status) {
    case 0:
      return new ToolError(error.message, 'Check the network or VPN, then try again.');
    case 401:
      return new ToolError(
        'ClickUp rejected the token.',
        'The token may be revoked or mistyped. Run `bun run doctor` on the machine running the server.',
      );
    case 403:
      return new ToolError(
        error.code === 'HOST_NOT_ALLOWED'
          ? error.message
          : `Your ClickUp account cannot open this ${what}.`,
        'Only what your own ClickUp account can open is readable here.',
      );
    case 404:
      return new ToolError(
        `No ${what} with that id in this workspace.`,
        'Copy the URL from ClickUp and pass it as is.',
      );
    case 413:
      return new ToolError(error.message, 'Open it in ClickUp instead.');
    case 429:
      return new ToolError('ClickUp is rate limiting this token.', 'Wait a minute and try again.');
    default:
      return new ToolError(
        `ClickUp could not return the ${what} (${error.status}${error.code ? ` ${error.code}` : ''}).`,
        'Try again in a moment.',
      );
  }
}

export async function guard<T>(what: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ApiError) throw explain(error, what);
    throw error;
  }
}

/** True for failures where a cached copy is better than nothing: network, timeout, 5xx, 429. */
export function isTransient(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 0 || error.status === 429 || error.status >= 500)
  );
}
