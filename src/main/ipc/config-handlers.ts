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
  ipcMain.handle('config:select-key-file', async () => {
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

      const providers = config.providers || { stt: 'google', translation: 'deepl', tts: 'google' };
      const errors: string[] = [];

      // Check Azure configuration if any Azure provider is selected
      const usingAzure = providers.stt === 'azure' || providers.translation === 'azure' || providers.tts === 'azure';

      if (usingAzure) {
        // Check Azure Speech (for STT and TTS)
        if ((providers.stt === 'azure' || providers.tts === 'azure')) {
          if (!config.azure?.speechKey) {
            errors.push('Azure Speech Key manquante');
          }
          if (!config.azure?.speechRegion) {
            errors.push('Azure Speech Region manquante');
          }
        }

        // Check Azure Translator
        if (providers.translation === 'azure') {
          if (!config.azure?.translatorKey) {
            errors.push('Azure Translator Key manquante');
          }
          if (!config.azure?.translatorRegion) {
            errors.push('Azure Translator Region manquante');
          }
          if (!config.azure?.translatorEndpoint) {
            errors.push('Azure Translator Endpoint manquant');
          }
        }
      }

      // Check Google Cloud configuration if any Google provider is selected
      const usingGoogle = providers.stt === 'google' || providers.tts === 'google';

      if (usingGoogle) {
        if (!config.googleCloud?.projectId) {
          errors.push('Google Cloud Project ID manquant');
        }
        if (!config.googleCloud?.keyFilePath) {
          errors.push('Google Cloud Key File manquant');
        } else {
          // Validate key file exists
          const keyFileExists = await configService.validateKeyFilePath(config.googleCloud.keyFilePath);
          if (!keyFileExists) {
            errors.push('Fichier de clés Google Cloud introuvable');
          }
        }
      }

      // Check DeepL configuration if selected
      if (providers.translation === 'deepl') {
        if (!config.deepl?.apiKey) {
          errors.push('Clé API DeepL manquante');
        }
      }

      // Return results
      if (errors.length > 0) {
        return {
          success: false,
          message: `❌ Configuration incomplète:\n• ${errors.join('\n• ')}`,
        };
      }

      // TODO: Implement actual service connection testing
      // For now, just check if all fields are present
      logger.info({ providers }, 'Config test passed (basic validation only)');
      return {
        success: true,
        message: `✅ Configuration valide!\n• STT: ${providers.stt}\n• Translation: ${providers.translation}\n• TTS: ${providers.tts}\n\n(Test de connexion réel à venir)`,
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
