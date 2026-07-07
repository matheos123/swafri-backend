import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';

function serialize(message: unknown): string {
  if (message instanceof Error) return message.stack ?? message.message;
  if (typeof message === 'object' && message !== null) {
    try {
      return JSON.stringify(message, Object.getOwnPropertyNames(message), 2);
    } catch {
      return String(message);
    }
  }
  return String(message);
}

@Injectable()
export class AppLogger extends ConsoleLogger {
  private fmt(level: string, message: unknown, context?: string): string {
    return JSON.stringify({
      level,
      message: serialize(message),
      context,
      timestamp: new Date().toISOString(),
    });
  }

  log(message: unknown, context?: string) {
    super.log(this.fmt('log', message, context), context);
  }

  error(message: unknown, trace?: string, context?: string) {
    super.error(this.fmt('error', message, context), trace, context);
  }

  warn(message: unknown, context?: string) {
    super.warn(this.fmt('warn', message, context), context);
  }

  debug(message: unknown, context?: string) {
    super.debug(this.fmt('debug', message, context), context);
  }

  verbose(message: unknown, context?: string) {
    super.verbose(this.fmt('verbose', message, context), context);
  }

  getLogLevels(): LogLevel[] {
    return ['log', 'error', 'warn', 'debug', 'verbose'];
  }
}
