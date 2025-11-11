/**
 * Azure Translator Service
 * Using Azure Cognitive Services Translator API
 */
import axios, { AxiosInstance } from 'axios';
import type {
  TranslationConfig,
  TranslationResult,
  TranslationService,
  ServiceMetrics,
} from '@shared/types/services';
import { createComponentLogger, logAPICall } from '@main/utils/logger';
import { retryWithBackoff } from '@main/utils/retry';
import { CircuitBreaker } from '@main/utils/circuit-breaker';
import { LRUCache } from 'lru-cache';

const logger = createComponentLogger('AzureTranslatorService');

interface AzureTranslationResponse {
  translations: Array<{
    text: string;
    to: string;
  }>;
  detectedLanguage?: {
    language: string;
    score: number;
  };
}

export class AzureTranslatorService implements TranslationService {
  private client: AxiosInstance | null = null;
  private config: TranslationConfig;
  private circuitBreaker: CircuitBreaker;
  private cache: LRUCache<string, TranslationResult> | null = null;
  private metrics: ServiceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
  };
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config: TranslationConfig) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker('AzureTranslator', {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
    });

    // Initialize cache if enabled
    if (config.cacheEnabled) {
      this.cache = new LRUCache<string, TranslationResult>({
        max: 1000, // Match Google service cache size
        ttl: 1000 * 60 * 60 * 24, // 24 hours
      });
    }
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Azure Translator service');

    try {
      if (!this.config.azureKey || !this.config.azureRegion || !this.config.azureEndpoint) {
        throw new Error('Azure Translator credentials not configured');
      }

      // Create axios client
      this.client = axios.create({
        baseURL: this.config.azureEndpoint,
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.azureKey,
          'Ocp-Apim-Subscription-Region': this.config.azureRegion,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10s timeout
      });

      logger.info({
        region: this.config.azureRegion,
        endpoint: this.config.azureEndpoint,
        cacheEnabled: this.config.cacheEnabled,
      }, 'Azure Translator service initialized successfully');
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize Azure Translator service');
      throw error;
    }
  }

  async translate(text: string): Promise<TranslationResult> {
    if (!this.client) {
      throw new Error('Azure Translator service not initialized');
    }

    if (!text || text.trim().length === 0) {
      return {
        originalText: text,
        translatedText: '',
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage: this.config.targetLanguage,
        timestamp: Date.now(),
      };
    }

    // Check cache
    const cacheKey = this.getCacheKey(text);
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.cacheHits++;
        logger.debug({ text: text.substring(0, 50) }, 'Translation cache hit');
        return cached;
      }
      this.cacheMisses++;
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.circuitBreaker.execute(() =>
        retryWithBackoff(() => this.translateText(text), { maxAttempts: 3 }, 'AzureTranslator')
      );

      const latency = Date.now() - startTime;
      this.metrics.successfulRequests++;
      this.updateAverageLatency(latency);

      // Store in cache
      if (this.cache) {
        this.cache.set(cacheKey, result);
      }

      logAPICall('Azure Translator', 'translate', latency, true, {
        textLength: text.length,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        cacheHitRatio: this.getCacheHitRatio(),
      });

      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.metrics.lastError = error as Error;

      const latency = Date.now() - startTime;
      logAPICall('Azure Translator', 'translate', latency, false, {
        error: (error as Error).message,
      });

      logger.error({ err: error, textLength: text.length }, 'Azure translation failed');
      throw error;
    }
  }

  private async translateText(text: string): Promise<TranslationResult> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const params = new URLSearchParams({
      'api-version': '3.0',
      from: this.mapLanguageCode(this.config.sourceLanguage),
      to: this.mapLanguageCode(this.config.targetLanguage),
    });

    const response = await this.client.post<AzureTranslationResponse[]>(
      `/translate?${params.toString()}`,
      [{ text }]
    );

    if (!response.data || response.data.length === 0) {
      throw new Error('Empty response from Azure Translator');
    }

    const translation = response.data[0];
    if (!translation?.translations || translation.translations.length === 0) {
      throw new Error('No translations in response');
    }

    const translatedText = translation.translations[0]?.text;
    if (!translatedText) {
      throw new Error('No translation text in response');
    }

    return {
      originalText: text,
      translatedText,
      sourceLanguage: this.config.sourceLanguage,
      targetLanguage: this.config.targetLanguage,
      timestamp: Date.now(),
    };
  }

  /**
   * Map language codes to Azure format
   * Azure uses ISO 639-1 codes (e.g., 'en', 'fr')
   */
  private mapLanguageCode(languageCode: string): string {
    // Extract base language code (e.g., 'en-US' -> 'en')
    return languageCode.split('-')[0]?.toLowerCase() || 'en';
  }

  private getCacheKey(text: string): string {
    return `${this.config.sourceLanguage}-${this.config.targetLanguage}-${text}`;
  }

  private getCacheHitRatio(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? (this.cacheHits / total) * 100 : 0;
  }

  private updateAverageLatency(latency: number): void {
    const total = this.metrics.totalRequests;
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (total - 1) + latency) / total;
  }

  getMetrics(): ServiceMetrics {
    return {
      ...this.metrics,
      cacheHitRatio: this.getCacheHitRatio(),
      cacheSize: this.cache?.size || 0,
    } as ServiceMetrics & { cacheHitRatio: number; cacheSize: number };
  }

  async close(): Promise<void> {
    if (this.cache) {
      this.cache.clear();
    }
    this.client = null;
    logger.info({
      cacheHitRatio: this.getCacheHitRatio().toFixed(1),
    }, 'Azure Translator service closed');
  }
}
