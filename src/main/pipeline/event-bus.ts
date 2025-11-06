/**
 * Event Bus for pipeline communication
 * Type-safe event emitter for audio pipeline stages
 */
import { EventEmitter } from 'events';
import { createComponentLogger } from '@main/utils/logger';
import type { STTResult, TranslationResult, TTSResult } from '@shared/types/services';
import type { LatencyMetrics } from '@shared/types/pipeline';

const logger = createComponentLogger('EventBus');

// Define all pipeline events
export interface PipelineEvents {
  'audio:captured': (chunk: Buffer) => void;
  'stt:result': (result: STTResult) => void;
  'translation:result': (result: TranslationResult) => void;
  'tts:result': (result: TTSResult) => void;
  'audio:output': (audio: Buffer) => void;
  'latency:update': (metrics: LatencyMetrics) => void;
  'pipeline:error': (error: Error, stage: string) => void;
  'pipeline:status': (status: string) => void;
  backpressure: (stage: string) => void;
}

/**
 * Type-safe Event Bus for pipeline
 */
export class PipelineEventBus {
  private emitter: EventEmitter;
  private eventCounts: Map<string, number> = new Map();

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // Increase for multiple subscribers
  }

  /**
   * Emit an event
   */
  emit<K extends keyof PipelineEvents>(event: K, ...args: Parameters<PipelineEvents[K]>): void {
    const count = this.eventCounts.get(event) || 0;
    this.eventCounts.set(event, count + 1);

    logger.debug({ event, count: count + 1 }, `Event emitted: ${event}`);
    this.emitter.emit(event, ...args);
  }

  /**
   * Subscribe to an event
   */
  on<K extends keyof PipelineEvents>(event: K, handler: PipelineEvents[K]): void {
    logger.debug({ event }, `Subscriber added: ${event}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.emitter.on(event, handler as any);
  }

  /**
   * Subscribe to an event (one-time)
   */
  once<K extends keyof PipelineEvents>(event: K, handler: PipelineEvents[K]): void {
    logger.debug({ event }, `One-time subscriber added: ${event}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.emitter.once(event, handler as any);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof PipelineEvents>(event: K, handler: PipelineEvents[K]): void {
    logger.debug({ event }, `Subscriber removed: ${event}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.emitter.off(event, handler as any);
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends keyof PipelineEvents>(event?: K): void {
    if (event) {
      logger.debug({ event }, `All subscribers removed: ${event}`);
      this.emitter.removeAllListeners(event);
    } else {
      logger.debug('All subscribers removed from all events');
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get event statistics
   */
  getStats(): Record<string, number> {
    return Object.fromEntries(this.eventCounts);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.eventCounts.clear();
  }
}

// Export singleton instance
export const pipelineEventBus = new PipelineEventBus();
