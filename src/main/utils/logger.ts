/**
 * Structured logging with Pino
 */
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

// Create logger with pretty printing in development
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    app: 'youtube-live-translator',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create child logger for specific component
 */
export function createComponentLogger(component: string) {
  return logger.child({ component });
}

/**
 * Log performance metrics
 */
export function logPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, unknown>
) {
  logger.info(
    {
      operation,
      duration,
      ...metadata,
    },
    `${operation} completed in ${duration}ms`
  );
}

/**
 * Log API call metrics
 */
export function logAPICall(
  service: string,
  method: string,
  duration: number,
  success: boolean,
  metadata?: Record<string, unknown>
) {
  logger.info(
    {
      service,
      method,
      duration,
      success,
      ...metadata,
    },
    `${service}.${method} - ${success ? 'success' : 'failure'} (${duration}ms)`
  );
}

/**
 * Log error with context
 */
export function logError(error: Error, context?: Record<string, unknown>) {
  logger.error(
    {
      err: error,
      stack: error.stack,
      ...context,
    },
    error.message
  );
}
