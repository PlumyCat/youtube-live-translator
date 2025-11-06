/**
 * DeepL Translation Service with LRU cache
 */
import * as deepl from 'deepl-node';
import type {
  TranslationConfig,
  TranslationResult,
  TranslationService,
  ServiceMetrics,
  ServiceStatus,
} from '@shared/types/services';
import { createComponentLogger, logAPICall } from '@main/utils/logger';
import { retryWithBackoff } from '@main/utils/retry';
import { CircuitBreaker } from '@main/utils/circuit-breaker';

const logger = createComponentLogger('TranslationService');

interface CacheEntry {
  result: TranslationResult;
  timestamp: number;
}

export class DeepLTranslationService implements TranslationService {
  private client: deepl.Translator | null = null;
  private config: TranslationConfig;
  private status: ServiceStatus = 'idle';
  private circuitBreaker: CircuitBreaker;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheMaxSize = 100;
  private cacheMaxAge = 3600000; // 1 hour
  private metrics: ServiceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
  };

  constructor(config: TranslationConfig) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker('DeepLTranslation', {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing DeepL Translation service');
    this.status = 'initializing';

    try {
      const apiKey = process.env.DEEPL_API_KEY;
      if (!apiKey) {
        throw new Error('DEEPL_API_KEY not found in environment variables');
      }

      this.client = new deepl.Translator(apiKey);

      this.status = 'ready';
      logger.info('DeepL Translation service initialized successfully');
    } catch (error) {
      this.status = 'error';
      logger.error({ err: error }, 'Failed to initialize Translation service');
      throw error;
    }
  }

  async translate(text: string): Promise<TranslationResult> {
    if (!this.client) {
      throw new Error('Translation service not initialized');
    }

    // Check cache if enabled
    if (this.config.cacheEnabled) {
      const cached = this.getCached(text);
      if (cached) {
        logger.debug({ textLength: text.length }, 'Translation cache hit');
        return cached.result;
      }
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.circuitBreaker.execute(() =>
        retryWithBackoff(
          async () => {
            const sourceLanguage = this.config.sourceLanguage || null;
            const response = await this.client!.translateText(
              text,
              sourceLanguage as deepl.SourceLanguageCode | null,
              this.config.targetLanguage as deepl.TargetLanguageCode
            );

            return {
              originalText: text,
              translatedText: response.text,
              sourceLanguage: this.config.sourceLanguage,
              targetLanguage: this.config.targetLanguage,
              timestamp: Date.now(),
            };
          },
          { maxAttempts: 3 },
          'Translation.translate'
        )
      );

      const duration = Date.now() - startTime;
      this.metrics.successfulRequests++;
      this.updateAverageLatency(duration);

      // Cache result
      if (this.config.cacheEnabled) {
        this.setCached(text, result);
      }

      logAPICall('DeepLTranslation', 'translate', duration, true, {
        originalLength: text.length,
        translatedLength: result.translatedText.length,
        cached: false,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.failedRequests++;
      this.metrics.lastError = error instanceof Error ? error : new Error(String(error));

      logAPICall('DeepLTranslation', 'translate', duration, false, {
        error: this.metrics.lastError.message,
      });

      throw error;
    }
  }

  async close(): Promise<void> {
    logger.info('Closing DeepL Translation service');
    this.client = null;
    this.status = 'closed';
    this.cache.clear();
  }

  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  getStatus(): ServiceStatus {
    return this.status;
  }

  getCacheStats(): { size: number; hitRatio: number } {
    const hitRatio =
      this.metrics.totalRequests > 0
        ? (this.metrics.totalRequests - this.metrics.successfulRequests) /
          this.metrics.totalRequests
        : 0;

    return {
      size: this.cache.size,
      hitRatio,
    };
  }

  private getCached(text: string): CacheEntry | null {
    const entry = this.cache.get(text);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.cacheMaxAge) {
      this.cache.delete(text);
      return null;
    }

    return entry;
  }

  private setCached(text: string, result: TranslationResult): void {
    // Implement LRU eviction
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(text, {
      result,
      timestamp: Date.now(),
    });
  }

  private updateAverageLatency(newLatency: number): void {
    const totalSuccessful = this.metrics.successfulRequests;
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (totalSuccessful - 1) + newLatency) / totalSuccessful;
  }
}
