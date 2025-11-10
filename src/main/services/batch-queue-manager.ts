/**
 * Batch Queue Manager - Manages sequential processing of multiple videos
 */
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { createComponentLogger } from '@main/utils/logger';
import { BatchVideoProcessor } from './batch-video-processor';
import { GoogleCloudSTTService } from './stt-service';
import { DeepLTranslationService } from './translation-service';
import { GoogleCloudTTSService } from './tts-service';
import type {
  QueueItem,
  QueueState,
  BatchProgress,
  BatchResult
} from '@shared/types/batch';

const logger = createComponentLogger('BatchQueueManager');

export class BatchQueueManager extends EventEmitter {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private currentItemId: string | null = null;
  private currentProcessor: BatchVideoProcessor | null = null;

  constructor(
    private sttService: GoogleCloudSTTService,
    private translationService: DeepLTranslationService,
    private ttsService: GoogleCloudTTSService
  ) {
    super();
  }

  /**
   * Add a video to the queue
   */
  addToQueue(url: string, collectionName?: string): QueueItem {
    const item: QueueItem = {
      id: randomUUID(),
      url,
      collectionName,
      status: 'pending',
      addedAt: Date.now(),
    };

    this.queue.push(item);
    logger.info({ itemId: item.id, url, collection: collectionName }, 'Added video to queue');

    this.emitQueueUpdate();

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processNext();
    }

    return item;
  }

  /**
   * Remove an item from the queue
   */
  removeFromQueue(itemId: string): boolean {
    const index = this.queue.findIndex(item => item.id === itemId);

    if (index === -1) {
      return false;
    }

    // Don't remove if currently processing
    if (this.queue[index].status === 'processing') {
      logger.warn({ itemId }, 'Cannot remove item currently being processed');
      return false;
    }

    this.queue.splice(index, 1);
    logger.info({ itemId }, 'Removed item from queue');

    this.emitQueueUpdate();
    return true;
  }

  /**
   * Clear all pending items from the queue
   */
  clearQueue(): number {
    const pendingCount = this.queue.filter(item => item.status === 'pending').length;
    this.queue = this.queue.filter(item => item.status !== 'pending');

    logger.info({ clearedCount: pendingCount }, 'Cleared pending items from queue');
    this.emitQueueUpdate();

    return pendingCount;
  }

  /**
   * Get current queue state
   */
  getQueueState(): QueueState {
    return {
      items: this.queue,
      currentItemId: this.currentItemId || undefined,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Stop processing the current item and clear queue
   */
  async stopAll(): Promise<void> {
    logger.info('Stopping all queue processing');

    // Clear pending items
    this.clearQueue();

    // Mark current as error if processing
    if (this.currentItemId) {
      const currentItem = this.queue.find(item => item.id === this.currentItemId);
      if (currentItem) {
        currentItem.status = 'error';
        currentItem.error = 'Stopped by user';
        currentItem.completedAt = Date.now();
      }
    }

    this.isProcessing = false;
    this.currentItemId = null;
    this.currentProcessor = null;

    this.emitQueueUpdate();
  }

  /**
   * Process next item in the queue
   */
  private async processNext(): Promise<void> {
    // Find next pending item
    const nextItem = this.queue.find(item => item.status === 'pending');

    if (!nextItem) {
      logger.info('No more items in queue');
      this.isProcessing = false;
      this.currentItemId = null;
      this.emitQueueUpdate();
      return;
    }

    this.isProcessing = true;
    this.currentItemId = nextItem.id;
    nextItem.status = 'processing';
    nextItem.startedAt = Date.now();

    logger.info({ itemId: nextItem.id, url: nextItem.url }, 'Processing queue item');
    this.emitQueueUpdate();

    try {
      // Create batch processor for this item
      this.currentProcessor = new BatchVideoProcessor(
        this.sttService,
        this.translationService,
        this.ttsService,
        {
          segmentDuration: 30,
          maxConcurrentSegments: 1,
          collectionName: nextItem.collectionName,
          keepIntermediateFiles: false,
          generateVideo: true,
          generateTranscripts: true,
        }
      );

      // Forward progress events
      this.currentProcessor.on('progress', (progress: BatchProgress) => {
        nextItem.progress = progress;
        this.emit('item-progress', nextItem);
        this.emitQueueUpdate();
      });

      // Process the video
      const result = await this.currentProcessor.processVideo(nextItem.url);

      // Update item status
      nextItem.status = 'completed';
      nextItem.result = result;
      nextItem.completedAt = Date.now();

      logger.info({ itemId: nextItem.id, videoTitle: result.videoTitle }, 'Queue item completed');
      this.emit('item-completed', nextItem);

    } catch (error) {
      // Update item status on error
      nextItem.status = 'error';
      nextItem.error = error instanceof Error ? error.message : 'Unknown error';
      nextItem.completedAt = Date.now();

      logger.error({ err: error, itemId: nextItem.id }, 'Queue item failed');
      this.emit('item-error', nextItem);
    } finally {
      this.currentProcessor = null;
      this.emitQueueUpdate();

      // Continue with next item
      this.processNext();
    }
  }

  /**
   * Emit queue state update
   */
  private emitQueueUpdate(): void {
    this.emit('queue-update', this.getQueueState());
  }
}
