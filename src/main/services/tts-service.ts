/**
 * Google Cloud Text-to-Speech Service
 */
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type {
  TTSConfig,
  TTSResult,
  TTSService,
  ServiceMetrics,
  ServiceStatus,
} from '@shared/types/services';
import { createComponentLogger, logAPICall } from '@main/utils/logger';
import { retryWithBackoff } from '@main/utils/retry';
import { CircuitBreaker } from '@main/utils/circuit-breaker';

const logger = createComponentLogger('TTSService');

export class GoogleCloudTTSService implements TTSService {
  private client: TextToSpeechClient | null = null;
  private config: TTSConfig;
  private status: ServiceStatus = 'idle';
  private circuitBreaker: CircuitBreaker;
  private metrics: ServiceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
  };

  constructor(config: TTSConfig) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker('GoogleCloudTTS', {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Google Cloud Text-to-Speech service');
    this.status = 'initializing';

    try {
      // Initialize with credentials from environment
      this.client = new TextToSpeechClient({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      });

      // Warm up: preload voice to reduce first-request latency
      await this.warmUp();

      this.status = 'ready';
      logger.info('Google Cloud Text-to-Speech service initialized successfully');
    } catch (error) {
      this.status = 'error';
      logger.error({ err: error }, 'Failed to initialize TTS service');
      throw error;
    }
  }

  async synthesize(text: string): Promise<TTSResult> {
    if (!this.client) {
      throw new Error('TTS service not initialized');
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.circuitBreaker.execute(() =>
        retryWithBackoff(
          async () => {
            const [response] = await this.client!.synthesizeSpeech({
              input: { text },
              voice: {
                languageCode: this.config.language,
                name: this.config.voiceName,
                ssmlGender: 'FEMALE', // fr-FR-Neural2-A is a female voice
              },
              audioConfig: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                audioEncoding: this.config.audioEncoding as any,
                sampleRateHertz: this.config.sampleRate,
                speakingRate: 1.0,
                pitch: 0.0,
              },
            });

            if (!response.audioContent) {
              throw new Error('No audio content returned from TTS service');
            }

            const audioBuffer = Buffer.from(response.audioContent as Uint8Array);

            return {
              audioContent: audioBuffer,
              duration: this.estimateAudioDuration(audioBuffer.length),
              timestamp: Date.now(),
            };
          },
          { maxAttempts: 3 },
          'TTS.synthesize'
        )
      );

      const duration = Date.now() - startTime;
      this.metrics.successfulRequests++;
      this.updateAverageLatency(duration);

      logAPICall('GoogleCloudTTS', 'synthesize', duration, true, {
        textLength: text.length,
        audioSize: result.audioContent.length,
        audioDuration: result.duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.failedRequests++;
      this.metrics.lastError = error instanceof Error ? error : new Error(String(error));

      logAPICall('GoogleCloudTTS', 'synthesize', duration, false, {
        error: this.metrics.lastError.message,
      });

      throw error;
    }
  }

  async close(): Promise<void> {
    logger.info('Closing Google Cloud Text-to-Speech service');
    this.client = null;
    this.status = 'closed';
  }

  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  getStatus(): ServiceStatus {
    return this.status;
  }

  /**
   * Warm up the service with a dummy request to reduce first-request latency
   */
  private async warmUp(): Promise<void> {
    try {
      logger.debug('Warming up TTS service');
      await this.client!.synthesizeSpeech({
        input: { text: '.' },
        voice: {
          languageCode: this.config.language,
          name: this.config.voiceName,
        },
        audioConfig: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          audioEncoding: this.config.audioEncoding as any,
          sampleRateHertz: this.config.sampleRate,
        },
      });
      logger.debug('TTS service warmed up successfully');
    } catch (error) {
      logger.warn({ err: error }, 'Failed to warm up TTS service (non-critical)');
    }
  }

  /**
   * Estimate audio duration from buffer size
   * Rough estimation: 16-bit PCM at sampleRate Hz
   */
  private estimateAudioDuration(bufferSize: number): number {
    const bytesPerSample = 2; // 16-bit = 2 bytes
    const samples = bufferSize / bytesPerSample;
    return (samples / this.config.sampleRate) * 1000; // in milliseconds
  }

  private updateAverageLatency(newLatency: number): void {
    const totalSuccessful = this.metrics.successfulRequests;
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (totalSuccessful - 1) + newLatency) / totalSuccessful;
  }
}
