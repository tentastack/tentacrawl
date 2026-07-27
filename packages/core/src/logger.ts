import type { LoggerService } from '@nestjs/common';
import pino, { type Logger as PinoLogger } from 'pino';

// /logger subpath only, never the main barrel, so it never reaches the web bundle
export interface PinoLoggerOptions {
  level?: string;
  name?: string;
}

export function createPinoRootLogger(options: PinoLoggerOptions = {}): PinoLogger {
  return pino({
    level: options.level ?? process.env['LOG_LEVEL'] ?? 'info',
    name: options.name,
    base: { pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
}

export class PinoNestLogger implements LoggerService {
  private readonly logger: PinoLogger;

  constructor(loggerOrOptions?: PinoLogger | PinoLoggerOptions) {
    this.logger = isPinoLogger(loggerOrOptions)
      ? loggerOrOptions
      : createPinoRootLogger(loggerOrOptions);
  }

  log(message: unknown, ...optional: unknown[]): void {
    this.logger.info(this.bindings(optional), asMessage(message));
  }

  error(message: unknown, ...optional: unknown[]): void {
    this.logger.error(this.bindings(optional), asMessage(message));
  }

  warn(message: unknown, ...optional: unknown[]): void {
    this.logger.warn(this.bindings(optional), asMessage(message));
  }

  debug(message: unknown, ...optional: unknown[]): void {
    this.logger.debug(this.bindings(optional), asMessage(message));
  }

  verbose(message: unknown, ...optional: unknown[]): void {
    this.logger.trace(this.bindings(optional), asMessage(message));
  }

  fatal(message: unknown, ...optional: unknown[]): void {
    this.logger.fatal(this.bindings(optional), asMessage(message));
  }

  // Nest: log(msg, context) / error(msg, stack, context)
  private bindings(optional: unknown[]): Record<string, unknown> {
    if (optional.length === 0) return {};
    if (optional.length === 1) return { context: asOptionalString(optional[0]) };
    return {
      stack: asOptionalString(optional[0]),
      context: asOptionalString(optional[optional.length - 1]),
    };
  }
}

function isPinoLogger(value: unknown): value is PinoLogger {
  return typeof (value as PinoLogger | undefined)?.info === 'function';
}

function asMessage(message: unknown): string {
  return typeof message === 'string' ? message : JSON.stringify(message);
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
