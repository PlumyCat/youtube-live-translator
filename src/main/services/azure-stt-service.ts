/**
 * Azure Speech-to-Text Service
 * Using Azure Cognitive Services Speech SDK
 */
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import type {
  STTConfig,
  STTResult,
  STTService,
  ServiceMetrics,
} from '@shared/types/services';
import { createComponentLogger, logAPICall } from '@main/utils/logger';
import { CircuitBreaker } from '@main/utils/circuit-breaker';

const logger = createComponentLogger('AzureSTTService');

export class AzureSpeechSTTService implements STTService {
  private recognizer: sdk.SpeechRecognizer | null = null;
  private config: STTConfig;
  private circuitBreaker: CircuitBreaker;
  private metrics: ServiceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
  };

  constructor(config: STTConfig) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker('AzureSpeechSTT', {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Azure Speech-to-Text service');

    try {
      if (!this.config.azureKey || !this.config.azureRegion) {
        throw new Error('Azure Speech credentials not configured');
      }

      // Create speech config
      const speechConfig = sdk.SpeechConfig.fromSubscription(
        this.config.azureKey,
        this.config.azureRegion
      );

      // Set language
      speechConfig.speechRecognitionLanguage = this.config.language;

      // Enable detailed results
      speechConfig.outputFormat = sdk.OutputFormat.Detailed;

      // Create push stream for audio input
      const pushStream = sdk.AudioInputStream.createPushStream();

      // Create audio config from push stream
      const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

      // Create recognizer
      this.recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      logger.info({
        language: this.config.language,
        region: this.config.azureRegion,
      }, 'Azure Speech-to-Text service initialized successfully');
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize Azure STT service');
      throw error;
    }
  }

  async transcribe(audioChunk: Buffer): Promise<STTResult> {
    if (!this.recognizer) {
      throw new Error('Azure STT service not initialized');
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.circuitBreaker.execute(() =>
        this.recognizeFromBuffer(audioChunk)
      );

      const latency = Date.now() - startTime;
      this.metrics.successfulRequests++;
      this.updateAverageLatency(latency);

      logAPICall('Azure Speech STT', 'transcribe', latency, true, {
        transcriptLength: result.transcript.length,
      });

      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.metrics.lastError = error as Error;

      const latency = Date.now() - startTime;
      logAPICall('Azure Speech STT', 'transcribe', latency, false, {
        error: (error as Error).message,
      });

      logger.error({ err: error }, 'Azure STT transcription failed');
      throw error;
    }
  }

  private async recognizeFromBuffer(audioChunk: Buffer): Promise<STTResult> {
    return new Promise((resolve, reject) => {
      if (!this.recognizer) {
        reject(new Error('Recognizer not initialized'));
        return;
      }

      // Create a new recognizer for this chunk
      const speechConfig = sdk.SpeechConfig.fromSubscription(
        this.config.azureKey!,
        this.config.azureRegion!
      );
      speechConfig.speechRecognitionLanguage = this.config.language;

      // Create push stream
      const pushStream = sdk.AudioInputStream.createPushStream();

      // Write audio chunk to stream (convert Buffer to ArrayBuffer)
      const arrayBuffer = audioChunk.buffer.slice(
        audioChunk.byteOffset,
        audioChunk.byteOffset + audioChunk.byteLength
      ) as ArrayBuffer;
      pushStream.write(arrayBuffer);
      pushStream.close();

      const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      // Recognize once
      recognizer.recognizeOnceAsync(
        (result) => {
          recognizer.close();

          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            resolve({
              transcript: result.text,
              confidence: result.properties?.getProperty(
                sdk.PropertyId.SpeechServiceResponse_JsonResult
              )
                ? JSON.parse(
                    result.properties.getProperty(
                      sdk.PropertyId.SpeechServiceResponse_JsonResult
                    )
                  ).NBest?.[0]?.Confidence || 0.95
                : 0.95,
              isFinal: true,
              timestamp: Date.now(),
            });
          } else if (result.reason === sdk.ResultReason.NoMatch) {
            // No speech detected in audio
            resolve({
              transcript: '',
              confidence: 0,
              isFinal: false,
              timestamp: Date.now(),
            });
          } else {
            reject(
              new Error(`Recognition failed: ${sdk.ResultReason[result.reason]}`)
            );
          }
        },
        (error) => {
          recognizer.close();
          reject(new Error(`Recognition error: ${error}`));
        }
      );
    });
  }

  private updateAverageLatency(latency: number): void {
    const total = this.metrics.totalRequests;
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (total - 1) + latency) / total;
  }

  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  async close(): Promise<void> {
    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
    }
    logger.info('Azure Speech-to-Text service closed');
  }
}
