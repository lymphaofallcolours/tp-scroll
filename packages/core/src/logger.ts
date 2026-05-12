export type LogContext = Readonly<Record<string, unknown>>;

export type Logger = {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
};

const noop = (): void => undefined;

export const NoopLogger: Logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};
