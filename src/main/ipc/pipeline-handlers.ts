/**
 * IPC Handlers for Audio Pipeline
 * Handles communication between renderer and main process
 */
import { ipcMain, BrowserWindow } from 'electron';
import { createComponentLogger } from '@main/utils/logger';
import { AudioPipeline } from '@main/pipeline/audio-pipeline';
import { pipelineEventBus } from '@main/pipeline/event-bus';
import type { PipelineConfig } from '@shared/types/pipeline';

const logger = createComponentLogger('IPCHandlers');

let currentPipeline: AudioPipeline | null = null;
let mainWindow: BrowserWindow | null = null;

/**
 * Register all IPC handlers
 */
export function registerPipelineHandlers(window: BrowserWindow): void {
  mainWindow = window;
  logger.info('Registering pipeline IPC handlers');

  // Start translation
  ipcMain.handle('translation:start', async (_event, url: string) => {
    logger.info({ url }, 'Translation start requested');

    try {
      // Stop existing pipeline if any
      if (currentPipeline) {
        await currentPipeline.stop();
        currentPipeline = null;
      }

      // Create pipeline config
      const config: PipelineConfig = {
        youtubeUrl: url,
        sttLanguage: process.env.STT_LANGUAGE || 'en-US',
        targetLanguage: process.env.TARGET_LANGUAGE || 'fr',
        targetLatency: parseInt(process.env.TARGET_LATENCY || '2000', 10),
        audioChunkDuration: parseInt(process.env.AUDIO_CHUNK_DURATION || '1500', 10),
      };

      // Create and initialize pipeline
      currentPipeline = new AudioPipeline(config);
      await currentPipeline.initialize();

      // Setup event forwarding to renderer
      setupEventForwarding();

      // Start pipeline
      await currentPipeline.start();

      logger.info('Translation started successfully');
      return { success: true };
    } catch (error) {
      logger.error({ err: error }, 'Failed to start translation');
      throw error;
    }
  });

  // Stop translation
  ipcMain.handle('translation:stop', async () => {
    logger.info('Translation stop requested');

    try {
      if (currentPipeline) {
        await currentPipeline.stop();
        currentPipeline = null;
      }

      logger.info('Translation stopped successfully');
      return { success: true };
    } catch (error) {
      logger.error({ err: error }, 'Failed to stop translation');
      throw error;
    }
  });

  // Get status
  ipcMain.handle('translation:status', () => {
    if (!currentPipeline) {
      return { status: 'idle' };
    }

    return {
      status: currentPipeline.getStatus(),
      latency: currentPipeline.getLatencyStats(),
      metrics: currentPipeline.getServiceMetrics(),
    };
  });
}

/**
 * Setup event forwarding from pipeline to renderer
 */
function setupEventForwarding(): void {
  if (!mainWindow) return;

  // Forward latency updates
  pipelineEventBus.on('latency:update', metrics => {
    mainWindow?.webContents.send('latency-update', metrics.total);
  });

  // Forward transcript updates
  pipelineEventBus.on('stt:result', result => {
    mainWindow?.webContents.send('transcript-update', result.transcript);
  });

  // Forward translation updates
  pipelineEventBus.on('translation:result', result => {
    mainWindow?.webContents.send('translation-update', result.translatedText);
  });

  // Forward status changes
  pipelineEventBus.on('pipeline:status', status => {
    mainWindow?.webContents.send('status-change', status);
  });

  // Forward errors
  pipelineEventBus.on('pipeline:error', (error, stage) => {
    mainWindow?.webContents.send('error', `Pipeline error in ${stage}: ${error.message}`);
  });

  logger.info('Event forwarding setup completed');
}

/**
 * Cleanup handlers on app quit
 */
export async function cleanupPipelineHandlers(): Promise<void> {
  logger.info('Cleaning up pipeline handlers');

  if (currentPipeline) {
    await currentPipeline.stop();
    currentPipeline = null;
  }

  pipelineEventBus.removeAllListeners();
}
