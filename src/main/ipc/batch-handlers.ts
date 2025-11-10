/**
 * IPC Handlers for Batch Processing
 */
import { ipcMain, BrowserWindow, shell } from 'electron';
import { createComponentLogger } from '@main/utils/logger';
import { BatchQueueManager } from '@main/services/batch-queue-manager';
import { GoogleCloudSTTService } from '@main/services/stt-service';
import { DeepLTranslationService } from '@main/services/translation-service';
import { GoogleCloudTTSService } from '@main/services/tts-service';
import { loadSTTConfig, loadTranslationConfig, loadTTSConfig } from '@main/config/services';
import type { QueueItem, QueueState } from '@shared/types/batch';

const logger = createComponentLogger('BatchHandlers');

let queueManager: BatchQueueManager | null = null;
let sttService: GoogleCloudSTTService | null = null;
let translationService: DeepLTranslationService | null = null;
let ttsService: GoogleCloudTTSService | null = null;

/**
 * Register batch processing IPC handlers
 */
export function registerBatchHandlers(mainWindow: BrowserWindow): void {
  logger.info('Registering batch processing IPC handlers');

  // Initialize services on first use
  const initializeServices = async () => {
    if (!sttService || !translationService || !ttsService) {
      logger.info('Initializing cloud services');

      const sttConfig = loadSTTConfig();
      const translationConfig = loadTranslationConfig();
      const ttsConfig = loadTTSConfig();

      sttService = new GoogleCloudSTTService(sttConfig);
      translationService = new DeepLTranslationService(translationConfig);
      ttsService = new GoogleCloudTTSService(ttsConfig);

      await sttService.initialize();
      await translationService.initialize();
      await ttsService.initialize();

      logger.info('Cloud services initialized');
    }
  };

  // Initialize queue manager on first use
  const initializeQueueManager = async () => {
    if (!queueManager) {
      await initializeServices();

      queueManager = new BatchQueueManager(
        sttService!,
        translationService!,
        ttsService!
      );

      // Setup event forwarding
      queueManager.on('queue-update', (state: QueueState) => {
        mainWindow.webContents.send('queue:update', state);
      });

      queueManager.on('item-progress', (item: QueueItem) => {
        mainWindow.webContents.send('queue:item-progress', item);
      });

      queueManager.on('item-completed', (item: QueueItem) => {
        mainWindow.webContents.send('queue:item-completed', item);
      });

      queueManager.on('item-error', (item: QueueItem) => {
        mainWindow.webContents.send('queue:item-error', item);
      });

      logger.info('Queue manager initialized');
    }
  };

  // Add video to queue
  ipcMain.handle('queue:add', async (_event, youtubeUrl: string, collectionName?: string) => {
    logger.info({ url: youtubeUrl, collection: collectionName }, 'Adding video to queue');

    try {
      await initializeQueueManager();
      const item = queueManager!.addToQueue(youtubeUrl, collectionName);
      return item;
    } catch (error) {
      logger.error({ err: error }, 'Failed to add video to queue');
      throw error;
    }
  });

  // Remove video from queue
  ipcMain.handle('queue:remove', async (_event, itemId: string) => {
    logger.info({ itemId }, 'Removing video from queue');

    if (!queueManager) {
      return false;
    }

    return queueManager.removeFromQueue(itemId);
  });

  // Clear queue
  ipcMain.handle('queue:clear', async () => {
    logger.info('Clearing queue');

    if (!queueManager) {
      return 0;
    }

    return queueManager.clearQueue();
  });

  // Get queue state
  ipcMain.handle('queue:get', async () => {
    if (!queueManager) {
      return {
        items: [],
        isProcessing: false,
      };
    }

    return queueManager.getQueueState();
  });

  // Stop all processing
  ipcMain.handle('queue:stop', async () => {
    logger.info('Stopping queue processing');

    if (!queueManager) {
      return;
    }

    await queueManager.stopAll();
  });

  // Shell operations for opening files
  ipcMain.handle('shell:openExternal', async (_event, path: string) => {
    logger.info({ path }, 'Opening file with external application');
    try {
      await shell.openPath(path);
    } catch (error) {
      logger.error({ err: error, path }, 'Failed to open file');
      throw error;
    }
  });

  ipcMain.handle('shell:showItemInFolder', async (_event, path: string) => {
    logger.info({ path }, 'Showing item in folder');
    try {
      shell.showItemInFolder(path);
    } catch (error) {
      logger.error({ err: error, path }, 'Failed to show item in folder');
      throw error;
    }
  });

  logger.info('Batch processing IPC handlers registered');
}

/**
 * Cleanup batch handlers
 */
export async function cleanupBatchHandlers(): Promise<void> {
  logger.info('Cleaning up batch handlers');

  // Cleanup queue manager
  if (queueManager) {
    await queueManager.stopAll();
    queueManager = null;
  }

  // Cleanup services
  if (sttService) {
    await sttService.close();
    sttService = null;
  }
  if (translationService) {
    await translationService.close();
    translationService = null;
  }
  if (ttsService) {
    await ttsService.close();
    ttsService = null;
  }

  // Remove handlers
  ipcMain.removeHandler('queue:add');
  ipcMain.removeHandler('queue:remove');
  ipcMain.removeHandler('queue:clear');
  ipcMain.removeHandler('queue:get');
  ipcMain.removeHandler('queue:stop');
  ipcMain.removeHandler('shell:openExternal');
  ipcMain.removeHandler('shell:showItemInFolder');
}
