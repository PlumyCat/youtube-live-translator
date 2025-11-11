/**
 * RetryWithBackoff Unit Tests
 * Target: 100% coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff } from './retry';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Success scenarios', () => {
    it('should return value on first successful attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = retryWithBackoff(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should return value after retry on success', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should succeed on last attempt', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('Failure scenarios', () => {
    it('should throw error after max attempts reached', async () => {
      const error = new Error('persistent failure');
      const fn = vi.fn().mockRejectedValue(error);

      const promise = retryWithBackoff(fn, { maxAttempts: 3 });
      const resultPromise = vi.runAllTimersAsync().then(() => promise);

      await expect(resultPromise).rejects.toThrow('persistent failure');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should preserve error type', async () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('custom error');
      const fn = vi.fn().mockRejectedValue(error);

      const promise = retryWithBackoff(fn, { maxAttempts: 2 });
      const resultPromise = vi.runAllTimersAsync().then(() => promise);

      try {
        await resultPromise;
        expect.fail('Should have thrown error');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('custom error');
      }
    });

    it('should handle non-Error rejections', async () => {
      const fn = vi.fn().mockRejectedValue('string error');

      const promise = retryWithBackoff(fn, { maxAttempts: 2 });
      const resultPromise = vi.runAllTimersAsync().then(() => promise);

      await expect(resultPromise).rejects.toThrow('string error');
    });
  });

  describe('Exponential backoff calculation', () => {
    it('should apply exponential backoff between retries', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
      });

      // First attempt - immediate
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Second attempt - after 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);

      // Third attempt - after 2000ms (1000 * 2^1)
      await vi.advanceTimersByTimeAsync(2000);
      expect(fn).toHaveBeenCalledTimes(3);

      await promise;
    });

    it('should respect maxDelayMs cap', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 5000,
        maxDelayMs: 8000,
        backoffMultiplier: 2,
      });

      // First attempt
      await vi.advanceTimersByTimeAsync(0);

      // Second attempt - 5000ms
      await vi.advanceTimersByTimeAsync(5000);

      // Third attempt - capped at 8000ms instead of 10000ms
      await vi.advanceTimersByTimeAsync(8000);

      await promise;
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use correct delays with default options', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn); // Default: 1000ms initial, 2x multiplier

      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000); // 1000ms
      expect(fn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(2000); // 2000ms
      expect(fn).toHaveBeenCalledTimes(3);

      await promise;
    });
  });

  describe('Configuration options', () => {
    it('should respect maxAttempts option', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      const promise = retryWithBackoff(fn, { maxAttempts: 5 });
      const resultPromise = vi.runAllTimersAsync().then(() => promise);

      await expect(resultPromise).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should use custom initialDelayMs', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxAttempts: 2,
        initialDelayMs: 3000,
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(3000);
      expect(fn).toHaveBeenCalledTimes(2);

      await promise;
    });

    it('should use custom backoffMultiplier', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 3, // 1000, 3000, 9000
      });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(3000);

      await promise;
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should merge partial options with defaults', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = retryWithBackoff(fn, {
        maxAttempts: 5, // Custom
        // Other options should use defaults
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(fn).toHaveBeenCalled();
    });
  });

  describe('Context parameter', () => {
    it('should accept context for logging purposes', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = retryWithBackoff(fn, {}, 'API call');
      await vi.runAllTimersAsync();
      await promise;

      expect(fn).toHaveBeenCalled();
    });

    it('should work without context parameter', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = retryWithBackoff(fn);
      await vi.runAllTimersAsync();
      await promise;

      expect(fn).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle maxAttempts = 1', async () => {
      const error = new Error('immediate failure');
      const fn = vi.fn().mockRejectedValue(error);

      const promise = retryWithBackoff(fn, { maxAttempts: 1 });
      const resultPromise = vi.runAllTimersAsync().then(() => promise);

      await expect(resultPromise).rejects.toThrow('immediate failure');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle very small delays', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxAttempts: 2,
        initialDelayMs: 1,
      });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1);

      await promise;
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle very large delays (capped)', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxAttempts: 2,
        initialDelayMs: 999999,
        maxDelayMs: 5000, // Should be capped
      });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(5000); // Capped delay

      await promise;
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle function throwing non-promise errors', async () => {
      const fn = vi.fn().mockImplementation(() => {
        throw new Error('sync error');
      });

      const promise = retryWithBackoff(fn, { maxAttempts: 2 });
      const resultPromise = vi.runAllTimersAsync().then(() => promise);

      await expect(resultPromise).rejects.toThrow('sync error');
    });
  });

  describe('Multiple concurrent retries', () => {
    it('should handle multiple independent retry operations', async () => {
      const fn1 = vi.fn().mockResolvedValue('success1');
      const fn2 = vi.fn().mockResolvedValue('success2');

      const [result1, result2] = await Promise.all([
        vi.runAllTimersAsync().then(() => retryWithBackoff(fn1)),
        vi.runAllTimersAsync().then(() => retryWithBackoff(fn2)),
      ]);

      expect(result1).toBe('success1');
      expect(result2).toBe('success2');
    });

    it('should handle mixed success/failure in concurrent retries', async () => {
      const successFn = vi.fn().mockResolvedValue('success');
      const failFn = vi.fn().mockRejectedValue(new Error('failure'));

      const results = await Promise.allSettled([
        vi.runAllTimersAsync().then(() => retryWithBackoff(successFn)),
        vi.runAllTimersAsync().then(() => retryWithBackoff(failFn, { maxAttempts: 1 })),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });
  });
});
