/**
 * IPC Handlers for Service Configuration
 *
 * Handles communication between renderer and main process for config management
 */

import { ipcMain, dialog } from 'electron';
import type { PartialServiceConfig } from '@shared/types';
import { getConfigStorageService } from '../services/config-storage';
import { logger } from '../utils/logger';

/**
 * Register all config-related IPC handlers
 */
export function registerConfigHandlers(): void {
  logger.info('Registering config IPC handlers');

  /**
   * Get current service configuration
   */
  ipcMain.handle('config:get', async () => {
    try {
      const configService = getConfigStorageService();
      const config = await configService.get();
      logger.debug({ config }, 'Config retrieved');
      return config;
    } catch (error) {
      logger.error({ err: error }, 'Failed to get config');
      throw error;
    }
  });

  /**
   * Save service configuration
   */
  ipcMain.handle('config:save', async (_event, newConfig: PartialServiceConfig) => {
    try {
      const configService = getConfigStorageService();
      await configService.save(newConfig);
      logger.info({ config: newConfig }, 'Config saved successfully');
      return { success: true };
    } catch (error) {
      logger.error({ err: error, config: newConfig }, 'Failed to save config');
      throw error;
    }
  });

  /**
   * Open file picker dialog for selecting Google Cloud key file
   */
  ipcMain.handle('config:select-key-file', async (event) => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Sélectionner le fichier de clés Google Cloud',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const filePath = result.filePaths[0];
      logger.info({ filePath }, 'Key file selected');
      return filePath;
    } catch (error) {
      logger.error({ err: error }, 'Failed to open file picker');
      throw error;
    }
  });

  /**
   * Validate Google Cloud key file path
   */
  ipcMain.handle('config:validate-key-file', async (_event, filePath: string) => {
    try {
      const configService = getConfigStorageService();
      const isValid = await configService.validateKeyFilePath(filePath);
      logger.debug({ filePath, isValid }, 'Key file validated');
      return isValid;
    } catch (error) {
      logger.error({ err: error, filePath }, 'Failed to validate key file');
      return false;
    }
  });

  /**
   * Test connection to services with current config
   */
  ipcMain.handle('config:test-connection', async () => {
    try {
      const configService = getConfigStorageService();
      const config = await configService.get();

      // Check if config is complete
      if (!config.googleCloud?.projectId || !config.googleCloud?.keyFilePath) {
        return {
          success: false,
          message: 'Configuration Google Cloud incomplète',
        };
      }

      if (!config.deepl?.apiKey) {
        return {
          success: false,
          message: 'Clé API DeepL manquante',
        };
      }

      // Validate key file exists
      const keyFileExists = await configService.validateKeyFilePath(config.googleCloud.keyFilePath);
      if (!keyFileExists) {
        return {
          success: false,
          message: 'Fichier de clés Google Cloud introuvable',
        };
      }

      // TODO: Implement actual service connection testing
      // For now, just check if all fields are present
      logger.info('Config test passed (basic validation only)');
      return {
        success: true,
        message: 'Configuration valide (test complet à venir)',
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to test config');
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  });

  logger.info('Config IPC handlers registered successfully');
}
