/**
 * A refusal from the ClickUp API, as the adapter reports it: the HTTP status and ClickUp's own error
 * code (ECODE). The engine turns it into a ToolError the model can act on.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
