/**
 * Audio Pipeline Orchestrator
 * Coordinates YouTube → STT → Translation → TTS → Audio Output
 */
import { createComponentLogger } from '@main/utils/logger';
import { LatencyMonitor } from '@main/utils/latency-monitor';
import { RingBuffer } from './ring-buffer';
import { pipelineEventBus } from './event-bus';
import { YouTubeCaptureService } from '@main/services/youtube-capture';
import { GoogleCloudSTTService } from '@main/services/stt-service';
import { DeepLTranslationService } from '@main/services/translation-service';
import { GoogleCloudTTSService } from '@main/services/tts-service';
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
  private sttService: GoogleCloudSTTService | null = null;
  private translationService: DeepLTranslationService | null = null;
  private ttsService: GoogleCloudTTSService | null = null;

  // Infrastructure
  private audioBuffer: RingBuffer<Buffer>;
  private transcriptBuffer: RingBuffer<string>;
  private latencyMonitor: LatencyMonitor;

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

      // Initialize services
      this.sttService = new GoogleCloudSTTService(sttConfig);
      await this.sttService.initialize();
      logger.info('STT service initialized');

      this.translationService = new DeepLTranslationService(translationConfig);
      await this.translationService.initialize();
      logger.info('Translation service initialized');

      this.ttsService = new GoogleCloudTTSService(ttsConfig);
      await this.ttsService.initialize();
      logger.info('TTS service initialized');

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
      // Start YouTube capture
      await this.youtubeCapture.start(async audioChunk => {
        await this.processAudioChunk(audioChunk.data);
      });
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
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle backpressure
    pipelineEventBus.on('backpressure', stage => {
      logger.warn({ stage }, 'Backpressure detected');
      // TODO: Implement backpressure handling (pause/throttle)
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
