/**
 * IPC Handlers for Batch Processing
 */
import { ipcMain, BrowserWindow, shell } from 'electron';
import { createComponentLogger } from '@main/utils/logger';
import { BatchVideoProcessor } from '@main/services/batch-video-processor';
import { GoogleCloudSTTService } from '@main/services/stt-service';
import { DeepLTranslationService } from '@main/services/translation-service';
import { GoogleCloudTTSService } from '@main/services/tts-service';
import { loadSTTConfig, loadTranslationConfig, loadTTSConfig } from '@main/config/services';
import type { BatchProgress, BatchResult } from '@shared/types/batch';

const logger = createComponentLogger('BatchHandlers');

let batchProcessor: BatchVideoProcessor | null = null;

/**
 * Register batch processing IPC handlers
 */
export function registerBatchHandlers(mainWindow: BrowserWindow): void {
  logger.info('Registering batch processing IPC handlers');

  // Start batch processing
  ipcMain.handle('batch:start', async (_event, youtubeUrl: string, collectionName?: string) => {
    logger.info({ url: youtubeUrl, collection: collectionName }, 'Batch processing start requested');

    try {
      // Initialize services
      const sttConfig = loadSTTConfig();
      const translationConfig = loadTranslationConfig();
      const ttsConfig = loadTTSConfig();

      const sttService = new GoogleCloudSTTService(sttConfig);
      const translationService = new DeepLTranslationService(translationConfig);
      const ttsService = new GoogleCloudTTSService(ttsConfig);

      await sttService.initialize();
      await translationService.initialize();
      await ttsService.initialize();

      // Create batch processor
      batchProcessor = new BatchVideoProcessor(
        sttService,
        translationService,
        ttsService,
        {
          segmentDuration: 30, // 30 seconds per segment
          maxConcurrentSegments: 1,
          collectionName: collectionName,
          keepIntermediateFiles: false,
          generateVideo: true,
          generateTranscripts: true,
        }
      );

      // Setup progress forwarding
      batchProcessor.on('progress', (progress: BatchProgress) => {
        mainWindow.webContents.send('batch:progress', progress);
      });

      batchProcessor.on('completed', (result: BatchResult) => {
        mainWindow.webContents.send('batch:completed', result);
      });

      batchProcessor.on('error', (error: Error) => {
        mainWindow.webContents.send('batch:error', {
          message: error.message,
          stack: error.stack,
        });
      });

      // Start processing
      const result = await batchProcessor.processVideo(youtubeUrl);

      // Cleanup services
      await sttService.close();
      await translationService.close();
      await ttsService.close();

      return result;

    } catch (error) {
      logger.error({ err: error }, 'Batch processing failed');
      throw error;
    }
  });

  // Get current progress
  ipcMain.handle('batch:getProgress', async () => {
    if (!batchProcessor) {
      return null;
    }
    return batchProcessor.getProgress();
  });

  // Stop batch processing (TODO: implement cancellation)
  ipcMain.handle('batch:stop', async () => {
    logger.info('Batch processing stop requested');
    // TODO: Implement cancellation logic
    batchProcessor = null;
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
  batchProcessor = null;
  ipcMain.removeHandler('batch:start');
  ipcMain.removeHandler('batch:getProgress');
  ipcMain.removeHandler('batch:stop');
  ipcMain.removeHandler('shell:openExternal');
  ipcMain.removeHandler('shell:showItemInFolder');
}
