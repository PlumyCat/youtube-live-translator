/**
 * Budget Tracker Service
 * Tracks API usage costs and provides budget monitoring
 *
 * Pricing (as of 2025):
 * - Google Cloud STT: ~$0.016 / minute (latest_short model)
 * - Google Cloud TTS: ~$0.000004 / character (Neural2 voices)
 * - DeepL Translation: ~$0.000025 / character (~$25 / 1M chars)
 */

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { logger } from '@main/utils/logger';
import { EventEmitter } from 'events';

/**
 * Service types for budget tracking
 */
export type ServiceType = 'stt' | 'tts' | 'translation';

/**
 * Budget usage entry
 */
export interface UsageEntry {
  timestamp: number;
  service: ServiceType;
  // For STT: audio duration in seconds
  // For TTS/Translation: character count
  units: number;
  cost: number;
}

/**
 * Monthly budget summary
 */
export interface BudgetSummary {
  month: string; // YYYY-MM
  totalCost: number;
  costByService: {
    stt: number;
    tts: number;
    translation: number;
  };
  entries: UsageEntry[];
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  monthlyLimit: number; // in dollars
  alertThreshold: number; // percentage (e.g., 80)
}

/**
 * Default pricing per unit
 * STT: $ per second
 * TTS/Translation: $ per character
 */
const PRICING: Record<ServiceType, number> = {
  stt: 0.016 / 60, // $0.016 per minute → per second
  tts: 0.000004, // $0.000004 per character
  translation: 0.000025, // $0.000025 per character
};

/**
 * Budget Tracker Service
 * Tracks API costs and provides budget monitoring with alerts
 */
export class BudgetTrackerService extends EventEmitter {
  private config: BudgetConfig;
  private dataFilePath: string;
  private currentMonth: string;
  private usageData: Map<string, BudgetSummary>; // month → summary
  private hasAlerted: boolean = false;

  constructor(config: Partial<BudgetConfig> = {}) {
    super();

    this.config = {
      monthlyLimit: config.monthlyLimit ?? 100, // $100/month default
      alertThreshold: config.alertThreshold ?? 80, // 80% default
    };

    // Store budget data in user data directory
    const userDataPath = app.getPath('userData');
    this.dataFilePath = path.join(userDataPath, 'budget-tracker.json');

    this.currentMonth = this.getCurrentMonth();
    this.usageData = new Map();

    logger.info({
      monthlyLimit: this.config.monthlyLimit,
      alertThreshold: this.config.alertThreshold,
      dataFilePath: this.dataFilePath,
    }, 'BudgetTrackerService initialized');
  }

  /**
   * Initialize service - load existing data
   */
  async initialize(): Promise<void> {
    try {
      await this.loadData();
      logger.info({ month: this.currentMonth }, 'Budget tracker loaded');

      // Check if alert needed
      this.checkBudgetThreshold();
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize budget tracker');
      throw error;
    }
  }

  /**
   * Track STT usage
   * @param durationSeconds Audio duration in seconds
   */
  async trackSTT(durationSeconds: number): Promise<void> {
    const cost = durationSeconds * PRICING.stt;
    await this.addEntry({
      timestamp: Date.now(),
      service: 'stt',
      units: durationSeconds,
      cost,
    });
  }

  /**
   * Track TTS usage
   * @param characterCount Number of characters synthesized
   */
  async trackTTS(characterCount: number): Promise<void> {
    const cost = characterCount * PRICING.tts;
    await this.addEntry({
      timestamp: Date.now(),
      service: 'tts',
      units: characterCount,
      cost,
    });
  }

  /**
   * Track Translation usage
   * @param characterCount Number of characters translated
   */
  async trackTranslation(characterCount: number): Promise<void> {
    const cost = characterCount * PRICING.translation;
    await this.addEntry({
      timestamp: Date.now(),
      service: 'translation',
      units: characterCount,
      cost,
    });
  }

  /**
   * Add usage entry and check threshold
   */
  private async addEntry(entry: UsageEntry): Promise<void> {
    const month = this.getCurrentMonth();

    // Check if month changed
    if (month !== this.currentMonth) {
      this.currentMonth = month;
      this.hasAlerted = false; // Reset alert for new month
    }

    // Get or create summary for current month
    let summary = this.usageData.get(month);
    if (!summary) {
      summary = {
        month,
        totalCost: 0,
        costByService: {
          stt: 0,
          tts: 0,
          translation: 0,
        },
        entries: [],
      };
      this.usageData.set(month, summary);
    }

    // Update summary
    summary.entries.push(entry);
    summary.totalCost += entry.cost;
    summary.costByService[entry.service] += entry.cost;

    // Save to disk
    await this.saveData();

    // Emit usage event
    this.emit('usage', {
      service: entry.service,
      cost: entry.cost,
      totalCost: summary.totalCost,
      monthlyLimit: this.config.monthlyLimit,
    });

    // Check budget threshold
    this.checkBudgetThreshold();

    logger.debug({
      service: entry.service,
      cost: entry.cost.toFixed(4),
      totalCost: summary.totalCost.toFixed(2),
      percentage: ((summary.totalCost / this.config.monthlyLimit) * 100).toFixed(1),
    }, 'Budget usage tracked');
  }

  /**
   * Check if budget threshold exceeded
   */
  private checkBudgetThreshold(): void {
    const summary = this.getCurrentMonthSummary();
    if (!summary) return;

    const percentage = (summary.totalCost / this.config.monthlyLimit) * 100;

    // Alert at threshold (once per month)
    if (percentage >= this.config.alertThreshold && !this.hasAlerted) {
      this.hasAlerted = true;
      this.emit('budget:threshold', {
        percentage: percentage.toFixed(1),
        totalCost: summary.totalCost.toFixed(2),
        monthlyLimit: this.config.monthlyLimit,
        threshold: this.config.alertThreshold,
      });

      logger.warn({
        percentage: percentage.toFixed(1),
        totalCost: summary.totalCost.toFixed(2),
        monthlyLimit: this.config.monthlyLimit,
      }, 'Budget threshold exceeded');
    }

    // Alert at 100%
    if (percentage >= 100) {
      this.emit('budget:exceeded', {
        percentage: percentage.toFixed(1),
        totalCost: summary.totalCost.toFixed(2),
        monthlyLimit: this.config.monthlyLimit,
      });

      logger.error({
        percentage: percentage.toFixed(1),
        totalCost: summary.totalCost.toFixed(2),
      }, 'Monthly budget exceeded');
    }
  }

  /**
   * Get current month summary
   */
  getCurrentMonthSummary(): BudgetSummary | null {
    return this.usageData.get(this.currentMonth) ?? null;
  }

  /**
   * Get summary for specific month
   */
  getMonthSummary(month: string): BudgetSummary | null {
    return this.usageData.get(month) ?? null;
  }

  /**
   * Get all months summaries
   */
  getAllSummaries(): BudgetSummary[] {
    return Array.from(this.usageData.values());
  }

  /**
   * Get budget metrics for current month
   */
  getMetrics(): {
    totalCost: number;
    costByService: { stt: number; tts: number; translation: number };
    monthlyLimit: number;
    percentage: number;
    remaining: number;
  } {
    const summary = this.getCurrentMonthSummary();

    if (!summary) {
      return {
        totalCost: 0,
        costByService: { stt: 0, tts: 0, translation: 0 },
        monthlyLimit: this.config.monthlyLimit,
        percentage: 0,
        remaining: this.config.monthlyLimit,
      };
    }

    const percentage = (summary.totalCost / this.config.monthlyLimit) * 100;
    const remaining = Math.max(0, this.config.monthlyLimit - summary.totalCost);

    return {
      totalCost: summary.totalCost,
      costByService: summary.costByService,
      monthlyLimit: this.config.monthlyLimit,
      percentage,
      remaining,
    };
  }

  /**
   * Load data from disk
   */
  private async loadData(): Promise<void> {
    try {
      const data = await fs.readFile(this.dataFilePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Convert to Map
      this.usageData = new Map(Object.entries(parsed));

      logger.info({ months: this.usageData.size }, 'Budget data loaded');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet - start fresh
        this.usageData = new Map();
        logger.info('No existing budget data, starting fresh');
      } else {
        logger.error({ err: error }, 'Failed to load budget data');
        throw error;
      }
    }
  }

  /**
   * Save data to disk
   */
  private async saveData(): Promise<void> {
    try {
      // Convert Map to object for JSON serialization
      const dataObj = Object.fromEntries(this.usageData);
      await fs.writeFile(this.dataFilePath, JSON.stringify(dataObj, null, 2), 'utf-8');
    } catch (error) {
      logger.error({ err: error }, 'Failed to save budget data');
      throw error;
    }
  }

  /**
   * Get current month in YYYY-MM format
   */
  private getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Reset current month data (for testing or manual reset)
   */
  async resetCurrentMonth(): Promise<void> {
    this.usageData.delete(this.currentMonth);
    this.hasAlerted = false;
    await this.saveData();
    logger.info({ month: this.currentMonth }, 'Current month budget reset');
  }

  /**
   * Close service (save final state)
   */
  async close(): Promise<void> {
    await this.saveData();
    this.removeAllListeners();
    logger.info('BudgetTrackerService closed');
  }
}
