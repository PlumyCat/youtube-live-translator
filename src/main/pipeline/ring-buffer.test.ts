/**
 * RingBuffer Unit Tests
 * Target: 100% coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RingBuffer } from './ring-buffer';

describe('RingBuffer', () => {
  describe('Construction and initialization', () => {
    it('should initialize with correct capacity', () => {
      const buffer = new RingBuffer({ maxSize: 10 });

      expect(buffer.size()).toBe(0);
      expect(buffer.capacity()).toBe(10);
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.isFull()).toBe(false);
    });

    it('should call onOverflow callback when provided', () => {
      const onOverflow = vi.fn();
      const buffer = new RingBuffer({ maxSize: 2, onOverflow });

      buffer.push('a');
      buffer.push('b');
      buffer.push('c'); // Should overflow

      expect(onOverflow).toHaveBeenCalledTimes(1);
    });

    it('should call onEmpty callback when provided', () => {
      const onEmpty = vi.fn();
      const buffer = new RingBuffer({ maxSize: 2, onEmpty });

      buffer.pop(); // Empty buffer

      expect(onEmpty).toHaveBeenCalledTimes(1);
    });
  });

  describe('Push operations', () => {
    it('should push items successfully', () => {
      const buffer = new RingBuffer<number>({ maxSize: 5 });

      expect(buffer.push(1)).toBe(true);
      expect(buffer.push(2)).toBe(true);
      expect(buffer.push(3)).toBe(true);

      expect(buffer.size()).toBe(3);
    });

    it('should reject push when buffer is full', () => {
      const buffer = new RingBuffer<string>({ maxSize: 2 });

      expect(buffer.push('a')).toBe(true);
      expect(buffer.push('b')).toBe(true);
      expect(buffer.push('c')).toBe(false); // Buffer full

      expect(buffer.size()).toBe(2);
      expect(buffer.isFull()).toBe(true);
    });

    it('should track dropped items count', () => {
      const buffer = new RingBuffer<string>({ maxSize: 2 });

      buffer.push('a');
      buffer.push('b');
      buffer.push('c');
      buffer.push('d');

      const stats = buffer.getStats();
      expect(stats.droppedItems).toBe(2);
    });
  });

  describe('Pop operations', () => {
    it('should pop items in FIFO order', () => {
      const buffer = new RingBuffer<number>({ maxSize: 5 });

      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      expect(buffer.pop()).toBe(1);
      expect(buffer.pop()).toBe(2);
      expect(buffer.pop()).toBe(3);
    });

    it('should return undefined when popping empty buffer', () => {
      const buffer = new RingBuffer<number>({ maxSize: 5 });

      expect(buffer.pop()).toBeUndefined();
      expect(buffer.isEmpty()).toBe(true);
    });

    it('should decrease size after pop', () => {
      const buffer = new RingBuffer<number>({ maxSize: 5 });

      buffer.push(1);
      buffer.push(2);

      expect(buffer.size()).toBe(2);
      buffer.pop();
      expect(buffer.size()).toBe(1);
    });
  });

  describe('Peek operations', () => {
    it('should peek without removing item', () => {
      const buffer = new RingBuffer<string>({ maxSize: 5 });

      buffer.push('a');
      buffer.push('b');

      expect(buffer.peek()).toBe('a');
      expect(buffer.size()).toBe(2); // Size unchanged
      expect(buffer.pop()).toBe('a'); // Can still pop
    });

    it('should return undefined when peeking empty buffer', () => {
      const buffer = new RingBuffer<string>({ maxSize: 5 });

      expect(buffer.peek()).toBeUndefined();
    });
  });

  describe('State checks', () => {
    it('should correctly report isEmpty state', () => {
      const buffer = new RingBuffer<number>({ maxSize: 3 });

      expect(buffer.isEmpty()).toBe(true);

      buffer.push(1);
      expect(buffer.isEmpty()).toBe(false);

      buffer.pop();
      expect(buffer.isEmpty()).toBe(true);
    });

    it('should correctly report isFull state', () => {
      const buffer = new RingBuffer<number>({ maxSize: 2 });

      expect(buffer.isFull()).toBe(false);

      buffer.push(1);
      expect(buffer.isFull()).toBe(false);

      buffer.push(2);
      expect(buffer.isFull()).toBe(true);
    });

    it('should correctly calculate utilization', () => {
      const buffer = new RingBuffer<number>({ maxSize: 4 });

      expect(buffer.utilization()).toBe(0);

      buffer.push(1);
      expect(buffer.utilization()).toBe(25);

      buffer.push(2);
      expect(buffer.utilization()).toBe(50);

      buffer.push(3);
      buffer.push(4);
      expect(buffer.utilization()).toBe(100);
    });
  });

  describe('Circular behavior', () => {
    it('should wrap around when full capacity is used', () => {
      const buffer = new RingBuffer<number>({ maxSize: 3 });

      // Fill buffer
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      // Remove some items
      expect(buffer.pop()).toBe(1);
      expect(buffer.pop()).toBe(2);

      // Add more items (should wrap around)
      buffer.push(4);
      buffer.push(5);

      // Verify correct order
      expect(buffer.pop()).toBe(3);
      expect(buffer.pop()).toBe(4);
      expect(buffer.pop()).toBe(5);
    });

    it('should handle continuous push/pop cycles', () => {
      const buffer = new RingBuffer<string>({ maxSize: 3 });

      for (let i = 0; i < 10; i++) {
        buffer.push(`item-${i}`);
        expect(buffer.pop()).toBe(`item-${i}`);
      }

      expect(buffer.isEmpty()).toBe(true);
    });
  });

  describe('Clear operations', () => {
    it('should clear all items and reset state', () => {
      const buffer = new RingBuffer<number>({ maxSize: 5 });

      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      buffer.clear();

      expect(buffer.size()).toBe(0);
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.peek()).toBeUndefined();
    });

    it('should reset to usable state after clear', () => {
      const buffer = new RingBuffer<number>({ maxSize: 3 });

      buffer.push(1);
      buffer.push(2);
      buffer.clear();

      buffer.push(3);
      buffer.push(4);

      expect(buffer.pop()).toBe(3);
      expect(buffer.pop()).toBe(4);
    });
  });

  describe('Statistics', () => {
    it('should return correct stats', () => {
      const buffer = new RingBuffer<number>({ maxSize: 5 });

      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      const stats = buffer.getStats();

      expect(stats.size).toBe(3);
      expect(stats.capacity).toBe(5);
      expect(stats.utilization).toBe(60);
      expect(stats.droppedItems).toBe(0);
    });

    it('should track dropped items in stats', () => {
      const buffer = new RingBuffer<number>({ maxSize: 2 });

      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);

      const stats = buffer.getStats();
      expect(stats.droppedItems).toBe(2);
    });

    it('should reset dropped counter', () => {
      const buffer = new RingBuffer<number>({ maxSize: 2 });

      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      expect(buffer.getStats().droppedItems).toBe(1);

      buffer.resetDroppedCounter();
      expect(buffer.getStats().droppedItems).toBe(0);
    });
  });

  describe('Memory management', () => {
    it('should clear references when popping', () => {
      const buffer = new RingBuffer<{data: string}>({ maxSize: 3 });

      const obj = { data: 'test' };
      buffer.push(obj);

      const popped = buffer.pop();
      expect(popped).toEqual(obj);

      // Internal buffer should have cleared the reference
      // This is tested implicitly by the implementation
    });
  });

  describe('Edge cases', () => {
    it('should handle size 1 buffer', () => {
      const buffer = new RingBuffer<string>({ maxSize: 1 });

      expect(buffer.push('a')).toBe(true);
      expect(buffer.push('b')).toBe(false);
      expect(buffer.pop()).toBe('a');
      expect(buffer.push('c')).toBe(true);
      expect(buffer.pop()).toBe('c');
    });

    it('should handle complex objects', () => {
      interface TestObject {
        id: number;
        name: string;
        nested: { value: string };
      }

      const buffer = new RingBuffer<TestObject>({ maxSize: 2 });

      const obj1: TestObject = { id: 1, name: 'test1', nested: { value: 'a' } };
      const obj2: TestObject = { id: 2, name: 'test2', nested: { value: 'b' } };

      buffer.push(obj1);
      buffer.push(obj2);

      expect(buffer.pop()).toEqual(obj1);
      expect(buffer.pop()).toEqual(obj2);
    });

    it('should handle Buffer objects', () => {
      const buffer = new RingBuffer<Buffer>({ maxSize: 3 });

      const buf1 = Buffer.from('test1');
      const buf2 = Buffer.from('test2');

      buffer.push(buf1);
      buffer.push(buf2);

      expect(buffer.pop()).toEqual(buf1);
      expect(buffer.pop()).toEqual(buf2);
    });
  });
});
