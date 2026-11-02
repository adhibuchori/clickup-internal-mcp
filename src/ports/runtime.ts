/** Ports: logging and time. */
export type LogFields = Readonly<Record<string, string | number | boolean>>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export interface Clock {
  now(): number;
}
