/**
 * Ring Buffer (Circular Buffer) for audio streaming
 * Implements backpressure handling for bounded buffering
 */
import { createComponentLogger } from '@main/utils/logger';

const logger = createComponentLogger('RingBuffer');

export interface RingBufferOptions {
  maxSize: number;
  onOverflow?: () => void;
  onEmpty?: () => void;
}

/**
 * Thread-safe Ring Buffer with backpressure support
 */
export class RingBuffer<T> {
  private buffer: Array<T | undefined>;
  private head = 0; // Write position
  private tail = 0; // Read position
  private count = 0; // Number of items in buffer
  private readonly maxSize: number;
  private readonly onOverflow?: () => void;
  private readonly onEmpty?: () => void;
  private droppedItems = 0;

  constructor(options: RingBufferOptions) {
    this.maxSize = options.maxSize;
    this.buffer = new Array(this.maxSize);
    this.onOverflow = options.onOverflow;
    this.onEmpty = options.onEmpty;
  }

  /**
   * Push item to buffer
   * @returns true if successful, false if buffer is full
   */
  push(item: T): boolean {
    if (this.isFull()) {
      this.droppedItems++;
      logger.warn(
        {
          droppedItems: this.droppedItems,
          bufferSize: this.count,
          maxSize: this.maxSize,
        },
        'Ring buffer overflow: item dropped'
      );

      if (this.onOverflow) {
        this.onOverflow();
      }

      return false;
    }

    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.maxSize;
    this.count++;

    return true;
  }

  /**
   * Pop item from buffer
   * @returns item or undefined if empty
   */
  pop(): T | undefined {
    if (this.isEmpty()) {
      if (this.onEmpty) {
        this.onEmpty();
      }
      return undefined;
    }

    const item = this.buffer[this.tail];
    this.buffer[this.tail] = undefined; // Clear reference for GC
    this.tail = (this.tail + 1) % this.maxSize;
    this.count--;

    return item;
  }

  /**
   * Peek at the next item without removing it
   */
  peek(): T | undefined {
    if (this.isEmpty()) {
      return undefined;
    }
    return this.buffer[this.tail];
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.count >= this.maxSize;
  }

  /**
   * Get current size
   */
  size(): number {
    return this.count;
  }

  /**
   * Get max capacity
   */
  capacity(): number {
    return this.maxSize;
  }

  /**
   * Get utilization percentage (0-100)
   */
  utilization(): number {
    return (this.count / this.maxSize) * 100;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.buffer = new Array(this.maxSize);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    logger.debug('Ring buffer cleared');
  }

  /**
   * Get statistics
   */
  getStats(): {
    size: number;
    capacity: number;
    utilization: number;
    droppedItems: number;
  } {
    return {
      size: this.count,
      capacity: this.maxSize,
      utilization: this.utilization(),
      droppedItems: this.droppedItems,
    };
  }

  /**
   * Reset dropped items counter
   */
  resetDroppedCounter(): void {
    this.droppedItems = 0;
  }
}
