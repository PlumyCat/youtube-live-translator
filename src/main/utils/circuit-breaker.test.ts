/**
 * CircuitBreaker Unit Tests
 * Target: 100% coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let circuit: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    circuit = new CircuitBreaker('test-circuit', {
      failureThreshold: 3,
      resetTimeoutMs: 5000,
      halfOpenMaxAttempts: 2,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial state', () => {
    it('should start in closed state', () => {
      expect(circuit.getState()).toBe('closed');
    });

    it('should use default options when not provided', () => {
      const defaultCircuit = new CircuitBreaker('default-circuit');
      expect(defaultCircuit.getState()).toBe('closed');
    });
  });

  describe('Closed state behavior', () => {
    it('should execute function successfully in closed state', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await circuit.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(circuit.getState()).toBe('closed');
    });

    it('should remain closed on single failure', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      await expect(circuit.execute(fn)).rejects.toThrow('failure');
      expect(circuit.getState()).toBe('closed');
    });

    it('should transition to open after reaching failure threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Fail 3 times (threshold)
      await expect(circuit.execute(fn)).rejects.toThrow();
      expect(circuit.getState()).toBe('closed');

      await expect(circuit.execute(fn)).rejects.toThrow();
      expect(circuit.getState()).toBe('closed');

      await expect(circuit.execute(fn)).rejects.toThrow();
      expect(circuit.getState()).toBe('open');
    });

    it('should reset failure count on success', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValueOnce('success');

      // 2 failures
      await expect(circuit.execute(fn)).rejects.toThrow();
      await expect(circuit.execute(fn)).rejects.toThrow();

      // Success resets counter
      await circuit.execute(fn);

      // Would need 3 more failures to open
      expect(circuit.getState()).toBe('closed');
    });
  });

  describe('Open state behavior', () => {
    beforeEach(async () => {
      // Force circuit to open state
      const fn = vi.fn().mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        await expect(circuit.execute(fn)).rejects.toThrow();
      }
      expect(circuit.getState()).toBe('open');
    });

    it('should reject immediately in open state', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await expect(circuit.execute(fn)).rejects.toThrow('Circuit breaker is OPEN for test-circuit');
      expect(fn).not.toHaveBeenCalled();
    });

    it('should transition to half-open after reset timeout', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      // Advance time past reset timeout
      vi.advanceTimersByTime(5000);

      await circuit.execute(fn);
      expect(circuit.getState()).toBe('half-open');
    });

    it('should stay open if reset timeout has not passed', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      // Advance time but not enough
      vi.advanceTimersByTime(4000);

      await expect(circuit.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
      expect(circuit.getState()).toBe('open');
    });
  });

  describe('Half-open state behavior', () => {
    beforeEach(async () => {
      // Force circuit to open state
      const failFn = vi.fn().mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        await expect(circuit.execute(failFn)).rejects.toThrow();
      }

      // Advance time to transition to half-open
      vi.advanceTimersByTime(5000);
    });

    it('should transition to closed after required successful attempts', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      // First success (half-open)
      await circuit.execute(fn);
      expect(circuit.getState()).toBe('half-open');

      // Second success (should close)
      await circuit.execute(fn);
      expect(circuit.getState()).toBe('closed');
    });

    it('should transition back to open on failure in half-open state', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('failure'));

      // First success (half-open)
      await circuit.execute(fn);
      expect(circuit.getState()).toBe('half-open');

      // Failure in half-open
      await expect(circuit.execute(fn)).rejects.toThrow('failure');
      expect(circuit.getState()).toBe('open');
    });

    it('should transition to open immediately on first failure in half-open', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Immediate failure in half-open
      await expect(circuit.execute(fn)).rejects.toThrow('failure');
      expect(circuit.getState()).toBe('open');
    });
  });

  describe('Reset functionality', () => {
    it('should reset to closed state', async () => {
      // Open the circuit
      const failFn = vi.fn().mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        await expect(circuit.execute(failFn)).rejects.toThrow();
      }
      expect(circuit.getState()).toBe('open');

      // Manual reset
      circuit.reset();

      expect(circuit.getState()).toBe('closed');
    });

    it('should reset counters on manual reset', async () => {
      // Create some failures
      const fn = vi.fn().mockRejectedValue(new Error('failure'));
      await expect(circuit.execute(fn)).rejects.toThrow();
      await expect(circuit.execute(fn)).rejects.toThrow();

      // Reset
      circuit.reset();

      // Should be able to succeed without opening
      const successFn = vi.fn().mockResolvedValue('success');
      await circuit.execute(successFn);
      expect(circuit.getState()).toBe('closed');
    });
  });

  describe('Error propagation', () => {
    it('should propagate errors to caller', async () => {
      const customError = new Error('Custom error message');
      const fn = vi.fn().mockRejectedValue(customError);

      await expect(circuit.execute(fn)).rejects.toThrow('Custom error message');
    });

    it('should propagate error type', async () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const customError = new CustomError('Custom error');
      const fn = vi.fn().mockRejectedValue(customError);

      try {
        await circuit.execute(fn);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Concurrent executions', () => {
    it('should handle multiple concurrent successful calls', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const results = await Promise.all([
        circuit.execute(fn),
        circuit.execute(fn),
        circuit.execute(fn),
      ]);

      expect(results).toEqual(['success', 'success', 'success']);
      expect(circuit.getState()).toBe('closed');
    });

    it('should handle mixed success/failure calls', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error('failure');
        }
        return 'success';
      });

      const results = await Promise.allSettled([
        circuit.execute(fn),
        circuit.execute(fn),
        circuit.execute(fn),
        circuit.execute(fn),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
      expect(results[3].status).toBe('rejected');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full cycle: closed -> open -> half-open -> closed', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('failure'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Start: closed
      expect(circuit.getState()).toBe('closed');

      // Transition to open (3 failures)
      for (let i = 0; i < 3; i++) {
        await expect(circuit.execute(failFn)).rejects.toThrow();
      }
      expect(circuit.getState()).toBe('open');

      // Advance time to half-open
      vi.advanceTimersByTime(5000);

      // Transition to closed (2 successes)
      await circuit.execute(successFn);
      expect(circuit.getState()).toBe('half-open');

      await circuit.execute(successFn);
      expect(circuit.getState()).toBe('closed');
    });

    it('should handle recovery with intermittent failures', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 3) {
          throw new Error('failure');
        }
        return 'success';
      });

      // 3 failures -> open
      for (let i = 0; i < 3; i++) {
        await expect(circuit.execute(fn)).rejects.toThrow();
      }
      expect(circuit.getState()).toBe('open');

      // Advance time
      vi.advanceTimersByTime(5000);

      // 2 successes -> closed
      await circuit.execute(fn);
      await circuit.execute(fn);
      expect(circuit.getState()).toBe('closed');
    });
  });

  describe('Custom names', () => {
    it('should support different circuit names', () => {
      const circuit1 = new CircuitBreaker('api-service');
      const circuit2 = new CircuitBreaker('database-service');

      expect(circuit1.getState()).toBe('closed');
      expect(circuit2.getState()).toBe('closed');
    });
  });
});
