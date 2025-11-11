/**
 * Audio Pipeline Orchestrator
 * Coordinates YouTube → STT → Translation → TTS → Audio Output
 */
import { createComponentLogger } from '@main/utils/logger';
import { LatencyMonitor } from '@main/utils/latency-monitor';
import { RingBuffer } from './ring-buffer';
import { pipelineEventBus } from './event-bus';
import { YouTubeCaptureService } from '@main/services/youtube-capture';
import { createSTTService, createTranslationService, createTTSService } from '@main/services/service-factory';
import type { STTService, TranslationService, TTSService } from '@shared/types/services';
import { loadSTTConfig, loadTranslationConfig, loadTTSConfig } from '@main/config/services';
import type { PipelineConfig, PipelineStatus } from '@shared/types/pipeline';

const logger = createComponentLogger('AudioPipeline');

/**
 * Main Audio Pipeline
 */
export class AudioPipeline {
  private status: PipelineStatus = 'idle';
  private config: PipelineConfig;

  // Services
  private youtubeCapture: YouTubeCaptureService | null = null;
  private sttService: STTService | null = null;
  private translationService: TranslationService | null = null;
  private ttsService: TTSService | null = null;

  // Infrastructure
  private audioBuffer: RingBuffer<Buffer>;
  // Note: transcriptBuffer is currently unused - reserved for future architecture
  // where STT and Translation stages could be decoupled with separate buffering
  private transcriptBuffer: RingBuffer<string>;
  private latencyMonitor: LatencyMonitor;

  // Backpressure control
  private isProcessing = false;
  private isPaused = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(config: PipelineConfig) {
    this.config = config;

    // Initialize buffers
    this.audioBuffer = new RingBuffer<Buffer>({
      maxSize: 10,
      onOverflow: () => pipelineEventBus.emit('backpressure', 'audio'),
    });

    this.transcriptBuffer = new RingBuffer<string>({
      maxSize: 5,
      onOverflow: () => pipelineEventBus.emit('backpressure', 'transcript'),
    });

    this.latencyMonitor = new LatencyMonitor(config.targetLatency);
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    logger.info('Initializing audio pipeline');
    this.status = 'starting';

    try {
      // Load service configurations
      const sttConfig = loadSTTConfig();
      const translationConfig = loadTranslationConfig();
      const ttsConfig = loadTTSConfig();

      // Initialize services using factory (supports multiple providers)
      this.sttService = createSTTService(sttConfig);
      await this.sttService.initialize();
      logger.info({ provider: sttConfig.provider }, 'STT service initialized');

      this.translationService = createTranslationService(translationConfig);
      await this.translationService.initialize();
      logger.info({ provider: translationConfig.provider }, 'Translation service initialized');

      this.ttsService = createTTSService(ttsConfig);
      await this.ttsService.initialize();
      logger.info({ provider: ttsConfig.provider }, 'TTS service initialized');

      // Setup YouTube capture
      this.youtubeCapture = new YouTubeCaptureService({
        url: this.config.youtubeUrl,
        quality: 'lowest', // Lower quality for lower latency
        chunkDuration: this.config.audioChunkDuration,
      });

      // Setup event handlers
      this.setupEventHandlers();

      logger.info('Audio pipeline initialized successfully');
    } catch (error) {
      this.status = 'error';
      logger.error({ err: error }, 'Failed to initialize audio pipeline');
      throw error;
    }
  }

  /**
   * Start the pipeline
   */
  async start(): Promise<void> {
    if (this.status === 'running') {
      throw new Error('Pipeline already running');
    }

    if (!this.youtubeCapture || !this.sttService || !this.translationService || !this.ttsService) {
      throw new Error('Pipeline not initialized');
    }

    logger.info({ url: this.config.youtubeUrl }, 'Starting audio pipeline');
    this.status = 'running';
    pipelineEventBus.emit('pipeline:status', 'running');

    try {
      // Start YouTube capture - push to buffer instead of direct processing
      await this.youtubeCapture.start(async audioChunk => {
        if (!this.isPaused) {
          const pushed = this.audioBuffer.push(audioChunk.data);
          if (!pushed) {
            logger.warn('Audio buffer full, chunk dropped');
          }
        }
      });

      // Start async processing loop
      this.startProcessingLoop();
    } catch (error) {
      this.status = 'error';
      logger.error({ err: error }, 'Failed to start pipeline');
      pipelineEventBus.emit('pipeline:error', error as Error, 'start');
      throw error;
    }
  }

  /**
   * Stop the pipeline
   */
  async stop(): Promise<void> {
    logger.info('Stopping audio pipeline');
    this.status = 'stopping';

    // Stop processing loop
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.youtubeCapture) {
      this.youtubeCapture.stop();
    }

    // Close services
    if (this.sttService) {
      await this.sttService.close();
    }
    if (this.translationService) {
      await this.translationService.close();
    }
    if (this.ttsService) {
      await this.ttsService.close();
    }

    // Clear buffers
    this.audioBuffer.clear();
    this.transcriptBuffer.clear();

    this.status = 'idle';
    pipelineEventBus.emit('pipeline:status', 'idle');
    logger.info('Audio pipeline stopped');
  }

  /**
   * Process audio chunk through pipeline
   */
  private async processAudioChunk(audioData: Buffer): Promise<void> {
    try {
      this.latencyMonitor.reset();
      this.latencyMonitor.startStage('capture');

      // Stage 1: Audio captured
      pipelineEventBus.emit('audio:captured', audioData);
      this.latencyMonitor.endStage('capture');

      // Stage 2: Speech-to-Text
      this.latencyMonitor.startStage('stt');
      const sttResult = await this.sttService!.transcribe(audioData);
      this.latencyMonitor.endStage('stt');

      if (sttResult.transcript && sttResult.isFinal) {
        pipelineEventBus.emit('stt:result', sttResult);

        // Stage 3: Translation
        this.latencyMonitor.startStage('translation');
        const translationResult = await this.translationService!.translate(sttResult.transcript);
        this.latencyMonitor.endStage('translation');
        pipelineEventBus.emit('translation:result', translationResult);

        // Stage 4: Text-to-Speech
        this.latencyMonitor.startStage('tts');
        const ttsResult = await this.ttsService!.synthesize(translationResult.translatedText);
        this.latencyMonitor.endStage('tts');
        pipelineEventBus.emit('tts:result', ttsResult);

        // Stage 5: Audio output (for now, just emit event)
        this.latencyMonitor.startStage('output');
        pipelineEventBus.emit('audio:output', ttsResult.audioContent);
        this.latencyMonitor.endStage('output');

        // Calculate and emit latency metrics
        const metrics = this.latencyMonitor.calculateMetrics();
        pipelineEventBus.emit('latency:update', metrics);

        logger.info(
          {
            total: metrics.total,
            breakdown: {
              stt: metrics.stt,
              translation: metrics.translation,
              tts: metrics.tts,
            },
          },
          `Pipeline cycle completed (${metrics.total}ms)`
        );
      }
    } catch (error) {
      logger.error({ err: error }, 'Error processing audio chunk');
      pipelineEventBus.emit('pipeline:error', error as Error, 'processing');
    }
  }

  /**
   * Start processing loop - POP from buffer and process
   */
  private startProcessingLoop(): void {
    // Process audio buffer at regular intervals
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing || this.status !== 'running') {
        return;
      }

      const audioData = this.audioBuffer.pop();
      if (!audioData) {
        return; // Buffer empty
      }

      this.isProcessing = true;
      try {
        await this.processAudioChunk(audioData);
      } catch (error) {
        logger.error({ err: error }, 'Error in processing loop');
      } finally {
        this.isProcessing = false;
      }
    }, 100); // Check every 100ms

    logger.info('Processing loop started');
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle backpressure - pause when buffers are full
    pipelineEventBus.on('backpressure', stage => {
      logger.warn({ stage, utilization: this.audioBuffer.utilization() }, 'Backpressure detected');

      if (!this.isPaused) {
        this.isPaused = true;
        logger.info('Pipeline paused due to backpressure');

        // Resume after buffer drains
        setTimeout(() => {
          if (this.audioBuffer.utilization() < 50) {
            this.isPaused = false;
            logger.info('Pipeline resumed');
          }
        }, 1000);
      }
    });
  }

  /**
   * Get pipeline status
   */
  getStatus(): PipelineStatus {
    return this.status;
  }

  /**
   * Get latency statistics
   */
  getLatencyStats() {
    return this.latencyMonitor.getStats();
  }

  /**
   * Get service metrics
   */
  getServiceMetrics() {
    return {
      stt: this.sttService?.getMetrics(),
      translation: this.translationService?.getMetrics(),
      tts: this.ttsService?.getMetrics(),
    };
  }
}
