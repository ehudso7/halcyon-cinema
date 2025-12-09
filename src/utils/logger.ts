/**
 * Centralized logging utility for Halcyon Cinema
 *
 * Provides structured logging with:
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - JSON output in production, readable format in development
 * - Context tracking (request ID, operation, timestamps)
 * - Performance metrics (query duration, API latency)
 * - Sensitive data masking
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
}

// Log level hierarchy for filtering
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get configured log level from environment
function getMinLogLevel(): number {
  const level = (process.env.LOG_LEVEL || 'debug').toLowerCase() as LogLevel;
  return LOG_LEVELS[level] ?? LOG_LEVELS.debug;
}

// Check if we should output in JSON format (production or explicitly set)
function shouldOutputJson(): boolean {
  if (process.env.LOG_FORMAT === 'json') return true;
  if (process.env.LOG_FORMAT === 'text') return false;
  return process.env.NODE_ENV === 'production';
}

// Mask sensitive data in context
function maskSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'passwordHash', 'secret', 'token', 'apiKey', 'authorization'];
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      masked[key] = maskSensitive(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

// Format error for logging
function formatError(error: unknown): LogEntry['error'] | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    const formatted: LogEntry['error'] = {
      name: error.name,
      message: error.message,
    };

    // Include error code if available (common in Node.js errors)
    if ('code' in error && typeof error.code === 'string') {
      formatted.code = error.code;
    }

    // Include stack in non-production for debugging
    if (process.env.NODE_ENV !== 'production' && error.stack) {
      formatted.stack = error.stack;
    }

    return formatted;
  }

  // Handle non-Error objects
  return {
    name: 'Unknown',
    message: String(error),
  };
}

// Format log entry for output
function formatLogEntry(entry: LogEntry): string {
  if (shouldOutputJson()) {
    return JSON.stringify(entry);
  }

  // Human-readable format for development
  const timestamp = entry.timestamp.substring(11, 23); // Just time portion
  const levelStr = entry.level.toUpperCase().padEnd(5);
  let msg = `${timestamp} ${levelStr} [${entry.component}] ${entry.message}`;

  if (entry.context && Object.keys(entry.context).length > 0) {
    const contextStr = Object.entries(entry.context)
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' ');
    msg += ` | ${contextStr}`;
  }

  if (entry.error) {
    msg += ` | error=${entry.error.name}: ${entry.error.message}`;
    if (entry.error.code) {
      msg += ` (${entry.error.code})`;
    }
    if (entry.error.stack) {
      msg += `\n${entry.error.stack}`;
    }
  }

  return msg;
}

// Output log entry
function outputLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  switch (entry.level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/**
 * Create a logger instance for a specific component
 */
export function createLogger(component: string) {
  const minLevel = getMinLogLevel();

  function log(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
    if (LOG_LEVELS[level] < minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = maskSensitive(context) as LogContext;
    }

    if (error) {
      entry.error = formatError(error);
    }

    outputLog(entry);
  }

  return {
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext, error?: unknown) => log('warn', message, context, error),
    error: (message: string, context?: LogContext, error?: unknown) => log('error', message, context, error),

    /**
     * Log with timing - returns a function to call when operation completes
     */
    startTimer: (operation: string, context?: LogContext) => {
      const start = Date.now();
      return {
        end: (additionalContext?: LogContext) => {
          const duration = Date.now() - start;
          log('debug', `${operation} completed`, {
            ...context,
            ...additionalContext,
            operation,
            duration,
          });
          return duration;
        },
        error: (error: unknown, additionalContext?: LogContext) => {
          const duration = Date.now() - start;
          log('error', `${operation} failed`, {
            ...context,
            ...additionalContext,
            operation,
            duration,
          }, error);
          return duration;
        },
      };
    },
  };
}

// Pre-configured loggers for common components
export const dbLogger = createLogger('db');
export const authLogger = createLogger('auth');
export const apiLogger = createLogger('api');
export const healthLogger = createLogger('health');

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Wrap an API handler with request logging
 */
export function withRequestLogging<T>(
  handler: (req: unknown, res: unknown) => Promise<T>,
  component: string = 'api'
): (req: unknown, res: unknown) => Promise<T> {
  const logger = createLogger(component);

  return async (req: unknown, res: unknown): Promise<T> => {
    const requestId = generateRequestId();
    const reqObj = req as { method?: string; url?: string; headers?: Record<string, string> };

    logger.info('Request started', {
      requestId,
      method: reqObj.method,
      url: reqObj.url,
    });

    const timer = logger.startTimer('Request processing', { requestId });

    try {
      const result = await handler(req, res);
      timer.end();
      return result;
    } catch (error) {
      timer.error(error);
      throw error;
    }
  };
}
