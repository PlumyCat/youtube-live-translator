/**
 * Retry logic with exponential backoff
 */
import { logger } from './logger';

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  const delay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
  return Math.min(delay, options.maxDelayMs);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  context?: string
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxAttempts) {
        logger.error(
          {
            context,
            attempt,
            maxAttempts: opts.maxAttempts,
            error: lastError.message,
          },
          'Retry failed: max attempts reached'
        );
        throw lastError;
      }

      const delay = calculateDelay(attempt, opts);
      logger.warn(
        {
          context,
          attempt,
          maxAttempts: opts.maxAttempts,
          delay,
          error: lastError.message,
        },
        `Retry attempt ${attempt} failed, retrying in ${delay}ms`
      );

      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
}
