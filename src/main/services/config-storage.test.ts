/**
 * ConfigStorageService Unit Tests
 * Target: 100% coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { ConfigStorageService } from './config-storage';
import type { PartialServiceConfig } from '@shared/types';

// Mock fs promises
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
  },
}));

describe('ConfigStorageService', () => {
  let service: ConfigStorageService;
  const mockConfigPath = '/tmp/test-user-data/config.json';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConfigStorageService();
  });

  describe('load()', () => {
    it('should return empty config when file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const config = await service.load();

      expect(config).toEqual({});
    });

    it('should load valid partial config', async () => {
      const mockConfig: PartialServiceConfig = {
        googleCloud: {
          projectId: 'test-project',
        },
        deepl: {
          apiKey: 'test-key',
        },
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const config = await service.load();

      expect(config).toEqual(mockConfig);
    });

    it('should load valid full config', async () => {
      const mockConfig: PartialServiceConfig = {
        googleCloud: {
          projectId: 'test-project',
          keyFilePath: '/path/to/key.json',
        },
        deepl: {
          apiKey: 'test-key',
        },
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const config = await service.load();

      expect(config).toEqual(mockConfig);
    });

    it('should return empty config on invalid JSON', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      const config = await service.load();

      expect(config).toEqual({});
    });

    it('should return empty config on validation error', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ invalid: 'data' }));

      const config = await service.load();

      expect(config).toEqual({});
    });

    it('should handle read errors gracefully', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Read error'));

      const config = await service.load();

      expect(config).toEqual({});
    });
  });

  describe('save()', () => {
    it('should save valid config', async () => {
      const newConfig: PartialServiceConfig = {
        googleCloud: {
          projectId: 'new-project',
          keyFilePath: '/new/key.json',
        },
        deepl: {
          apiKey: 'new-key',
        },
      };

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.save(newConfig);

      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData).toEqual(newConfig);
    });

    it('should merge with existing config', async () => {
      const existingConfig: PartialServiceConfig = {
        googleCloud: {
          projectId: 'existing-project',
        },
      };

      const newConfig: PartialServiceConfig = {
        deepl: {
          apiKey: 'new-key',
        },
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.save(newConfig);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);

      expect(writtenData.googleCloud?.projectId).toBe('existing-project');
      expect(writtenData.deepl?.apiKey).toBe('new-key');
    });

    it('should deep merge nested objects', async () => {
      const existingConfig: PartialServiceConfig = {
        googleCloud: {
          projectId: 'existing-project',
          keyFilePath: '/existing/key.json',
        },
      };

      const newConfig: PartialServiceConfig = {
        googleCloud: {
          projectId: 'new-project',
        },
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.save(newConfig);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);

      expect(writtenData.googleCloud?.projectId).toBe('new-project');
      expect(writtenData.googleCloud?.keyFilePath).toBe('/existing/key.json');
    });

    it('should create directory if it does not exist', async () => {
      const newConfig: PartialServiceConfig = {
        googleCloud: { projectId: 'test' },
      };

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.save(newConfig);

      expect(fs.mkdir).toHaveBeenCalled();
    });

    it('should throw error on write failure', async () => {
      const newConfig: PartialServiceConfig = {
        googleCloud: { projectId: 'test' },
      };

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write failed'));

      await expect(service.save(newConfig)).rejects.toThrow();
    });

    it('should reject invalid config structure', async () => {
      const invalidConfig = {
        invalid: { structure: 'test' },
      } as any;

      await expect(service.save(invalidConfig)).rejects.toThrow();
    });
  });

  describe('get()', () => {
    it('should return loaded config', async () => {
      const mockConfig: PartialServiceConfig = {
        googleCloud: {
          projectId: 'test-project',
          keyFilePath: '/path/to/key.json',
        },
        deepl: {
          apiKey: 'test-key',
        },
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const config = await service.get();

      expect(config).toEqual(mockConfig);
    });

    it('should return empty config when not loaded', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const config = await service.get();

      expect(config).toEqual({});
    });

    it('should cache loaded config', async () => {
      const mockConfig: PartialServiceConfig = {
        googleCloud: {
          projectId: 'test-project',
          keyFilePath: '/key.json',
        },
        deepl: {
          apiKey: 'test-key',
        },
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      // First call loads from file
      await service.get();

      // Second call should use cache (no additional fs calls)
      vi.clearAllMocks();
      const cachedConfig = await service.get();

      expect(cachedConfig).toEqual(mockConfig);
      expect(fs.readFile).not.toHaveBeenCalled();
    });
  });

  describe('isConfigured()', () => {
    it('should return true for complete config', async () => {
      const completeConfig: PartialServiceConfig = {
        googleCloud: {
          projectId: 'test-project',
          keyFilePath: '/path/to/key.json',
        },
        deepl: {
          apiKey: 'test-key',
        },
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(completeConfig));

      const isConfigured = await service.isConfigured();

      expect(isConfigured).toBe(true);
    });

    it('should return false for partial config', async () => {
      const partialConfig: PartialServiceConfig = {
        googleCloud: {
          projectId: 'test-project',
        },
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(partialConfig));

      const isConfigured = await service.isConfigured();

      expect(isConfigured).toBe(false);
    });

    it('should return false for empty config', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const isConfigured = await service.isConfigured();

      expect(isConfigured).toBe(false);
    });
  });

  describe('validateKeyFilePath()', () => {
    it('should return true for existing file', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const isValid = await service.validateKeyFilePath('/path/to/key.json');

      expect(isValid).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const isValid = await service.validateKeyFilePath('/path/to/missing.json');

      expect(isValid).toBe(false);
    });

    it('should handle access errors gracefully', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Permission denied'));

      const isValid = await service.validateKeyFilePath('/path/to/key.json');

      expect(isValid).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent save operations', async () => {
      const config1: PartialServiceConfig = { googleCloud: { projectId: 'p1' } };
      const config2: PartialServiceConfig = { deepl: { apiKey: 'k2' } };

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await Promise.all([
        service.save(config1),
        service.save(config2),
      ]);

      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should handle empty partial config', async () => {
      const emptyConfig: PartialServiceConfig = {};

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.save(emptyConfig);

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle config with only googleCloud', async () => {
      const config: PartialServiceConfig = {
        googleCloud: {
          projectId: 'test-project',
          keyFilePath: '/key.json',
        },
      };

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.save(config);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.googleCloud).toEqual(config.googleCloud);
    });

    it('should handle config with only deepl', async () => {
      const config: PartialServiceConfig = {
        deepl: {
          apiKey: 'test-key',
        },
      };

      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.save(config);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.deepl).toEqual(config.deepl);
    });
  });
});
