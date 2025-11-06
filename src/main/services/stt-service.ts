/**
 * Google Cloud Speech-to-Text Service
 */
import { SpeechClient } from '@google-cloud/speech';
import type {
  STTConfig,
  STTResult,
  STTService,
  ServiceMetrics,
  ServiceStatus,
} from '@shared/types/services';
import { createComponentLogger, logAPICall } from '@main/utils/logger';
import { retryWithBackoff } from '@main/utils/retry';
import { CircuitBreaker } from '@main/utils/circuit-breaker';

const logger = createComponentLogger('STTService');

export class GoogleCloudSTTService implements STTService {
  private client: SpeechClient | null = null;
  private config: STTConfig;
  private status: ServiceStatus = 'idle';
  private circuitBreaker: CircuitBreaker;
  private metrics: ServiceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
  };

  constructor(config: STTConfig) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker('GoogleCloudSTT', {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Google Cloud Speech-to-Text service');
    this.status = 'initializing';

    try {
      // Initialize with credentials from environment
      this.client = new SpeechClient({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      });

      this.status = 'ready';
      logger.info('Google Cloud Speech-to-Text service initialized successfully');
    } catch (error) {
      this.status = 'error';
      logger.error({ err: error }, 'Failed to initialize STT service');
      throw error;
    }
  }

  async transcribe(audioChunk: Buffer): Promise<STTResult> {
    if (!this.client) {
      throw new Error('STT service not initialized');
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.circuitBreaker.execute(() =>
        retryWithBackoff(
          async () => {
            const [response] = await this.client!.recognize({
              config: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                encoding: this.config.encoding as any,
                sampleRateHertz: this.config.sampleRate,
                languageCode: this.config.language,
                model: 'latest_short', // Optimized for low latency
                useEnhanced: true,
              },
              audio: {
                content: audioChunk.toString('base64'),
              },
            });

            if (!response.results || response.results.length === 0) {
              return {
                transcript: '',
                confidence: 0,
                isFinal: false,
                timestamp: Date.now(),
              };
            }

            const result = response.results[0];
            const alternative = result?.alternatives?.[0];

            return {
              transcript: alternative?.transcript || '',
              confidence: alternative?.confidence || 0,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              isFinal: Boolean((result as any)?.isFinal),
              timestamp: Date.now(),
            };
          },
          { maxAttempts: 3 },
          'STT.transcribe'
        )
      );

      const duration = Date.now() - startTime;
      this.metrics.successfulRequests++;
      this.updateAverageLatency(duration);

      logAPICall('GoogleCloudSTT', 'transcribe', duration, true, {
        transcriptLength: result.transcript.length,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.failedRequests++;
      this.metrics.lastError = error instanceof Error ? error : new Error(String(error));

      logAPICall('GoogleCloudSTT', 'transcribe', duration, false, {
        error: this.metrics.lastError.message,
      });

      throw error;
    }
  }

  async close(): Promise<void> {
    logger.info('Closing Google Cloud Speech-to-Text service');
    this.client = null;
    this.status = 'closed';
  }

  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  getStatus(): ServiceStatus {
    return this.status;
  }

  private updateAverageLatency(newLatency: number): void {
    const totalSuccessful = this.metrics.successfulRequests;
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (totalSuccessful - 1) + newLatency) / totalSuccessful;
  }
}
