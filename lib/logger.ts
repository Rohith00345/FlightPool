export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  userId?: string;
  tripId?: string;
  poolId?: string;
  flightId?: string;
  paymentId?: string;
  traceId?: string;
  ip?: string;
  [key: string]: unknown;
}

export class StructuredLogger {
  private service = "flightpool";
  private isProd = process.env.NODE_ENV === "production";

  private format(level: LogLevel, message: string, context?: LogContext, error?: unknown): string {
    const logObject = {
      service: this.service,
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...(context ? { context } : {}),
      ...(error instanceof Error
        ? {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          }
        : error
        ? { error: String(error) }
        : {}),
    };

    return JSON.stringify(logObject);
  }

  debug(message: string, context?: LogContext) {
    if (!this.isProd) {
      console.debug(`[DEBUG] ${message}`, context || "");
    }
  }

  info(message: string, context?: LogContext) {
    if (this.isProd) {
      console.log(this.format("info", message, context));
    } else {
      console.log(`[INFO] ${message}`, context || "");
    }
  }

  warn(message: string, context?: LogContext, error?: unknown) {
    if (this.isProd) {
      console.warn(this.format("warn", message, context, error));
    } else {
      console.warn(`[WARN] ${message}`, context || "", error || "");
    }
  }

  error(message: string, context?: LogContext, error?: unknown) {
    if (this.isProd) {
      console.error(this.format("error", message, context, error));
    } else {
      console.error(`[ERROR] ${message}`, context || "", error || "");
    }
  }
}

export const logger = new StructuredLogger();
