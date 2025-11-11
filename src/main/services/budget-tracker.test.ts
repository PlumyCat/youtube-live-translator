/**
 * Budget Tracker Service Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BudgetTrackerService } from './budget-tracker';
import type { BudgetConfig } from './budget-tracker';
import fs from 'fs/promises';

// Mock fs promises
vi.mock('fs/promises');

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

describe('BudgetTrackerService', () => {
  let service: BudgetTrackerService;
  let mockReadFile: any;
  let mockWriteFile: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fs functions
    mockReadFile = vi.mocked(fs.readFile);
    mockWriteFile = vi.mocked(fs.writeFile);

    // Default: no existing file
    mockReadFile.mockRejectedValue({ code: 'ENOENT' });
    mockWriteFile.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (service) {
      await service.close();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default config', async () => {
      service = new BudgetTrackerService();
      await service.initialize();

      const metrics = service.getMetrics();
      expect(metrics.monthlyLimit).toBe(100);
      expect(metrics.totalCost).toBe(0);
      expect(metrics.percentage).toBe(0);
    });

    it('should initialize with custom config', async () => {
      service = new BudgetTrackerService({
        monthlyLimit: 50,
        alertThreshold: 90,
      });
      await service.initialize();

      const metrics = service.getMetrics();
      expect(metrics.monthlyLimit).toBe(50);
    });

    it('should load existing data from disk', async () => {
      const existingData = {
        '2025-01': {
          month: '2025-01',
          totalCost: 25.5,
          costByService: {
            stt: 10.0,
            tts: 5.5,
            translation: 10.0,
          },
          entries: [
            { timestamp: Date.now(), service: 'stt', units: 100, cost: 10.0 },
          ],
        },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(existingData));

      service = new BudgetTrackerService();
      await service.initialize();

      const summaries = service.getAllSummaries();
      expect(summaries).toHaveLength(1);
      expect(summaries[0].totalCost).toBe(25.5);
    });

    it('should handle corrupted data file gracefully', async () => {
      mockReadFile.mockResolvedValue('invalid json');

      service = new BudgetTrackerService();
      await expect(service.initialize()).rejects.toThrow();
    });
  });

  describe('STT Tracking', () => {
    beforeEach(async () => {
      service = new BudgetTrackerService({ monthlyLimit: 100 });
      await service.initialize();
    });

    it('should track STT usage correctly', async () => {
      // Track 60 seconds (1 minute)
      await service.trackSTT(60);

      const metrics = service.getMetrics();
      // $0.016 per minute
      expect(metrics.totalCost).toBeCloseTo(0.016, 5);
      expect(metrics.costByService.stt).toBeCloseTo(0.016, 5);
      expect(metrics.costByService.tts).toBe(0);
      expect(metrics.costByService.translation).toBe(0);
    });

    it('should track multiple STT calls', async () => {
      await service.trackSTT(60); // 1 minute
      await service.trackSTT(120); // 2 minutes

      const metrics = service.getMetrics();
      // 3 minutes total = $0.048
      expect(metrics.totalCost).toBeCloseTo(0.048, 5);
      expect(metrics.costByService.stt).toBeCloseTo(0.048, 5);
    });

    it('should emit usage event on STT tracking', async () => {
      const usageHandler = vi.fn();
      service.on('usage', usageHandler);

      await service.trackSTT(60);

      expect(usageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'stt',
          cost: expect.any(Number),
          totalCost: expect.any(Number),
          monthlyLimit: 100,
        })
      );
    });
  });

  describe('TTS Tracking', () => {
    beforeEach(async () => {
      service = new BudgetTrackerService({ monthlyLimit: 100 });
      await service.initialize();
    });

    it('should track TTS usage correctly', async () => {
      // Track 1000 characters
      await service.trackTTS(1000);

      const metrics = service.getMetrics();
      // $0.000004 per character × 1000 = $0.004
      expect(metrics.totalCost).toBeCloseTo(0.004, 5);
      expect(metrics.costByService.tts).toBeCloseTo(0.004, 5);
    });

    it('should track multiple TTS calls', async () => {
      await service.trackTTS(1000);
      await service.trackTTS(500);

      const metrics = service.getMetrics();
      // 1500 characters = $0.006
      expect(metrics.totalCost).toBeCloseTo(0.006, 5);
    });
  });

  describe('Translation Tracking', () => {
    beforeEach(async () => {
      service = new BudgetTrackerService({ monthlyLimit: 100 });
      await service.initialize();
    });

    it('should track translation usage correctly', async () => {
      // Track 1000 characters
      await service.trackTranslation(1000);

      const metrics = service.getMetrics();
      // $0.000025 per character × 1000 = $0.025
      expect(metrics.totalCost).toBeCloseTo(0.025, 5);
      expect(metrics.costByService.translation).toBeCloseTo(0.025, 5);
    });

    it('should track multiple translation calls', async () => {
      await service.trackTranslation(1000);
      await service.trackTranslation(2000);

      const metrics = service.getMetrics();
      // 3000 characters = $0.075
      expect(metrics.totalCost).toBeCloseTo(0.075, 5);
    });
  });

  describe('Mixed Service Tracking', () => {
    beforeEach(async () => {
      service = new BudgetTrackerService({ monthlyLimit: 100 });
      await service.initialize();
    });

    it('should track usage across all services', async () => {
      await service.trackSTT(60); // $0.016
      await service.trackTTS(1000); // $0.004
      await service.trackTranslation(1000); // $0.025

      const metrics = service.getMetrics();
      expect(metrics.totalCost).toBeCloseTo(0.045, 5);
      expect(metrics.costByService.stt).toBeCloseTo(0.016, 5);
      expect(metrics.costByService.tts).toBeCloseTo(0.004, 5);
      expect(metrics.costByService.translation).toBeCloseTo(0.025, 5);
    });

    it('should calculate percentage correctly', async () => {
      await service.trackTranslation(4_000_000); // $100 (4M chars × $0.000025)

      const metrics = service.getMetrics();
      expect(metrics.totalCost).toBeCloseTo(100, 1);
      expect(metrics.percentage).toBeCloseTo(100, 1);
      expect(metrics.remaining).toBeCloseTo(0, 1);
    });
  });

  describe('Budget Alerts', () => {
    it('should emit threshold alert at 80%', async () => {
      service = new BudgetTrackerService({
        monthlyLimit: 100,
        alertThreshold: 80,
      });
      await service.initialize();

      const thresholdHandler = vi.fn();
      service.on('budget:threshold', thresholdHandler);

      // Reach 80%: $80
      await service.trackTranslation(3_200_000); // 3.2M chars × $0.000025 = $80

      expect(thresholdHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          percentage: expect.stringContaining('80'),
          totalCost: expect.any(String),
          monthlyLimit: 100,
          threshold: 80,
        })
      );
    });

    it('should emit threshold alert only once per month', async () => {
      service = new BudgetTrackerService({
        monthlyLimit: 100,
        alertThreshold: 80,
      });
      await service.initialize();

      const thresholdHandler = vi.fn();
      service.on('budget:threshold', thresholdHandler);

      // Reach 80%
      await service.trackTranslation(3_200_000); // $80
      expect(thresholdHandler).toHaveBeenCalledTimes(1);

      // Add more (still in same month)
      await service.trackTranslation(400_000); // $10 more = $90
      expect(thresholdHandler).toHaveBeenCalledTimes(1); // Still only once
    });

    it('should emit exceeded alert at 100%', async () => {
      service = new BudgetTrackerService({ monthlyLimit: 100 });
      await service.initialize();

      const exceededHandler = vi.fn();
      service.on('budget:exceeded', exceededHandler);

      // Reach 100%: $100
      await service.trackTranslation(4_000_000); // 4M chars × $0.000025 = $100

      expect(exceededHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          percentage: expect.stringContaining('100'),
          totalCost: expect.any(String),
          monthlyLimit: 100,
        })
      );
    });

    it('should not alert below threshold', async () => {
      service = new BudgetTrackerService({
        monthlyLimit: 100,
        alertThreshold: 80,
      });
      await service.initialize();

      const thresholdHandler = vi.fn();
      service.on('budget:threshold', thresholdHandler);

      // Only 50%
      await service.trackTranslation(2_000_000); // $50

      expect(thresholdHandler).not.toHaveBeenCalled();
    });
  });

  describe('Data Persistence', () => {
    it('should save data after each entry', async () => {
      service = new BudgetTrackerService();
      await service.initialize();

      await service.trackSTT(60);

      expect(mockWriteFile).toHaveBeenCalled();
      const savedData = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      const monthKeys = Object.keys(savedData);
      expect(monthKeys.length).toBeGreaterThan(0);
      expect(monthKeys[0]).toMatch(/\d{4}-\d{2}/);
    });

    it('should save correct data structure', async () => {
      service = new BudgetTrackerService();
      await service.initialize();

      await service.trackSTT(60);
      await service.trackTTS(1000);

      const savedData = JSON.parse(mockWriteFile.mock.calls[1][1] as string);
      const monthKey = Object.keys(savedData)[0];
      const monthData = savedData[monthKey];

      expect(monthData).toHaveProperty('month');
      expect(monthData).toHaveProperty('totalCost');
      expect(monthData).toHaveProperty('costByService');
      expect(monthData).toHaveProperty('entries');
      expect(monthData.entries).toHaveLength(2);
    });
  });

  describe('Metrics and Summaries', () => {
    beforeEach(async () => {
      service = new BudgetTrackerService({ monthlyLimit: 100 });
      await service.initialize();
    });

    it('should return current month summary', async () => {
      await service.trackSTT(60);

      const summary = service.getCurrentMonthSummary();
      expect(summary).not.toBeNull();
      expect(summary?.month).toMatch(/\d{4}-\d{2}/);
      expect(summary?.totalCost).toBeGreaterThan(0);
      expect(summary?.entries).toHaveLength(1);
    });

    it('should return null for non-existent month', () => {
      const summary = service.getMonthSummary('2020-01');
      expect(summary).toBeNull();
    });

    it('should return all summaries', async () => {
      // Mock multiple months
      const multiMonthData = {
        '2025-01': {
          month: '2025-01',
          totalCost: 10,
          costByService: { stt: 10, tts: 0, translation: 0 },
          entries: [],
        },
        '2025-02': {
          month: '2025-02',
          totalCost: 20,
          costByService: { stt: 0, tts: 20, translation: 0 },
          entries: [],
        },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(multiMonthData));

      service = new BudgetTrackerService();
      await service.initialize();

      const summaries = service.getAllSummaries();
      expect(summaries).toHaveLength(2);
    });

    it('should calculate remaining budget', async () => {
      await service.trackTranslation(2_000_000); // $50

      const metrics = service.getMetrics();
      expect(metrics.remaining).toBeCloseTo(50, 1);
    });

    it('should show zero remaining when over budget', async () => {
      await service.trackTranslation(4_400_000); // $110 (over budget)

      const metrics = service.getMetrics();
      expect(metrics.remaining).toBe(0);
      expect(metrics.percentage).toBeGreaterThan(100);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset current month data', async () => {
      service = new BudgetTrackerService();
      await service.initialize();

      await service.trackSTT(60);
      let metrics = service.getMetrics();
      expect(metrics.totalCost).toBeGreaterThan(0);

      await service.resetCurrentMonth();
      metrics = service.getMetrics();
      expect(metrics.totalCost).toBe(0);
    });
  });

  describe('Service Lifecycle', () => {
    it('should close cleanly', async () => {
      service = new BudgetTrackerService();
      await service.initialize();

      await service.trackSTT(60);
      await service.close();

      // Should have saved data on close
      expect(mockWriteFile).toHaveBeenCalled();
    });
  });
});
