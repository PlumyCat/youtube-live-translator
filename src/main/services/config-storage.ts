/**
 * Configuration Storage Service
 *
 * Handles loading and saving service configuration to persistent storage.
 * Config is stored in app.getPath('userData')/config.json
 */

import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { ServiceConfig, PartialServiceConfig } from '@shared/types';
import { logger } from '../utils/logger';

// Zod schema for validation
const ServiceConfigSchema = z.object({
  googleCloud: z.object({
    projectId: z.string(),
    keyFilePath: z.string(),
  }),
  deepl: z.object({
    apiKey: z.string(),
  }),
});

const PartialServiceConfigSchema = z.object({
  googleCloud: z.object({
    projectId: z.string().optional(),
    keyFilePath: z.string().optional(),
  }).optional(),
  deepl: z.object({
    apiKey: z.string().optional(),
  }).optional(),
});

/**
 * Configuration Storage Service
 */
export class ConfigStorageService {
  private configPath: string;
  private config: ServiceConfig | null = null;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    logger.info({ configPath: this.configPath }, 'ConfigStorageService initialized');
  }

  /**
   * Load configuration from disk
   * Returns partial config if file doesn't exist or is invalid
   */
  async load(): Promise<PartialServiceConfig> {
    try {
      const fileExists = await fs.access(this.configPath).then(() => true).catch(() => false);

      if (!fileExists) {
        logger.info('Config file does not exist, returning empty config');
        return {};
      }

      const fileContent = await fs.readFile(this.configPath, 'utf-8');
      const rawConfig = JSON.parse(fileContent);

      // Validate with partial schema first
      const validatedConfig = PartialServiceConfigSchema.parse(rawConfig);

      // Try to parse as full config
      try {
        this.config = ServiceConfigSchema.parse(validatedConfig);
        logger.info('Full configuration loaded successfully');
      } catch (error) {
        logger.warn({ config: validatedConfig }, 'Partial configuration loaded (some fields missing)');
        this.config = null;
      }

      return validatedConfig;
    } catch (error) {
      logger.error({ err: error, configPath: this.configPath }, 'Failed to load config');
      return {};
    }
  }

  /**
   * Save configuration to disk
   * Merges with existing config if partial
   */
  async save(newConfig: PartialServiceConfig): Promise<void> {
    try {
      // Validate input
      const validatedNewConfig = PartialServiceConfigSchema.parse(newConfig);

      // Load existing config
      const existingConfig = await this.load();

      // Merge configs (deep merge)
      const mergedConfig: PartialServiceConfig = {
        googleCloud: {
          ...(existingConfig.googleCloud || {}),
          ...(validatedNewConfig.googleCloud || {}),
        },
        deepl: {
          ...(existingConfig.deepl || {}),
          ...(validatedNewConfig.deepl || {}),
        },
      };

      // Ensure userData directory exists
      const userDataPath = app.getPath('userData');
      await fs.mkdir(userDataPath, { recursive: true });

      // Save to file
      await fs.writeFile(
        this.configPath,
        JSON.stringify(mergedConfig, null, 2),
        'utf-8'
      );

      // Update in-memory config
      try {
        this.config = ServiceConfigSchema.parse(mergedConfig);
        logger.info('Full configuration saved successfully');
      } catch (error) {
        logger.warn({ config: mergedConfig }, 'Partial configuration saved (some fields missing)');
        this.config = null;
      }
    } catch (error) {
      logger.error({ err: error, configPath: this.configPath }, 'Failed to save config');
      throw new Error('Failed to save configuration: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Get current configuration
   * Returns partial config if not fully configured
   */
  async get(): Promise<PartialServiceConfig> {
    if (!this.config) {
      return await this.load();
    }
    return this.config;
  }

  /**
   * Check if configuration is complete
   */
  async isConfigured(): Promise<boolean> {
    await this.load();
    return this.config !== null;
  }

  /**
   * Validate that a file path exists
   */
  async validateKeyFilePath(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let instance: ConfigStorageService | null = null;

export function getConfigStorageService(): ConfigStorageService {
  if (!instance) {
    instance = new ConfigStorageService();
  }
  return instance;
}
