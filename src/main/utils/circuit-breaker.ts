/**
 * Circuit Breaker pattern for API fault tolerance
 */
import { logger } from './logger';

type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  halfOpenMaxAttempts: 3,
};

/**
 * Circuit Breaker to prevent cascading failures
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private options: CircuitBreakerOptions;
  private name: string;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;

      if (timeSinceLastFailure >= this.options.resetTimeoutMs) {
        logger.info({ circuit: this.name }, 'Circuit breaker: transitioning to half-open');
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        logger.warn(
          {
            circuit: this.name,
            failureCount: this.failureCount,
            timeSinceLastFailure,
          },
          'Circuit breaker: request rejected (circuit open)'
        );
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'half-open') {
      this.successCount++;

      if (this.successCount >= this.options.halfOpenMaxAttempts) {
        logger.info(
          {
            circuit: this.name,
            successCount: this.successCount,
          },
          'Circuit breaker: transitioning to closed'
        );
        this.state = 'closed';
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      logger.warn(
        { circuit: this.name },
        'Circuit breaker: transitioning to open (half-open failure)'
      );
      this.state = 'open';
      this.successCount = 0;
    } else if (this.failureCount >= this.options.failureThreshold) {
      logger.warn(
        {
          circuit: this.name,
          failureCount: this.failureCount,
          threshold: this.options.failureThreshold,
        },
        'Circuit breaker: transitioning to open (threshold reached)'
      );
      this.state = 'open';
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    logger.info({ circuit: this.name }, 'Circuit breaker: manually reset');
  }
}
