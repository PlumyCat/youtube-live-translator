/**
 * Transcript-based Pipeline
 * Alternative pipeline that uses YouTube transcripts instead of STT
 * Much faster and cheaper when transcripts are available
 */
import { createComponentLogger } from '@main/utils/logger';
import { LatencyMonitor } from '@main/utils/latency-monitor';
import { pipelineEventBus } from './event-bus';
import { getYouTubeTranscriptService, TranscriptSegment } from '@main/services/youtube-transcript-service';
import type { TranslationService, TTSService } from '@shared/types/services';
import type { PipelineConfig } from '@shared/types/pipeline';

const logger = createComponentLogger('TranscriptPipeline');

export class TranscriptPipeline {
  private config: PipelineConfig;
  private translationService: TranslationService;
  private ttsService: TTSService;
  private latencyMonitor: LatencyMonitor;
  private transcriptService = getYouTubeTranscriptService();
  private isProcessing = false;
  private currentSegmentIndex = 0;
  private segments: TranscriptSegment[] = [];

  constructor(
    config: PipelineConfig,
    translationService: TranslationService,
    ttsService: TTSService
  ) {
    this.config = config;
    this.translationService = translationService;
    this.ttsService = ttsService;
    this.latencyMonitor = new LatencyMonitor(config.targetLatency);
  }

  /**
   * Check if transcripts are available for the video
   */
  async checkAvailability(): Promise<{
    available: boolean;
    languages: string[];
    estimatedSavings: {
      sttCost: number;
      transcriptCost: number;
      savings: number;
      savingsPercent: number;
    };
  }> {
    try {
      const availability = await this.transcriptService.checkAvailability(this.config.youtubeUrl);

      // Estimate cost savings (assume 1 hour video for estimation)
      const estimatedDuration = 3600; // 1 hour
      const sttProvider = process.env.STT_PROVIDER === 'azure' ? 'azure' : 'google';
      const estimatedSavings = this.transcriptService.estimateCostSavings(
        estimatedDuration,
        sttProvider as 'azure' | 'google'
      );

      logger.info({
        available: availability.available,
        languages: availability.languages,
        estimatedSavings,
      }, 'Transcript availability checked');

      return {
        available: availability.available,
        languages: availability.languages,
        estimatedSavings,
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to check transcript availability');
      throw error;
    }
  }

  /**
   * Start processing with transcripts
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Transcript pipeline already processing');
    }

    logger.info({ url: this.config.youtubeUrl }, 'Starting transcript-based pipeline');

    try {
      // Get best available transcript language
      const transcriptLang = await this.transcriptService.getBestLanguage(
        this.config.youtubeUrl,
        this.config.transcriptLanguage || this.config.sttLanguage
      );

      if (!transcriptLang) {
        throw new Error('No suitable transcript language found');
      }

      logger.info({ transcriptLang }, 'Using transcript language');

      // Fetch transcript
      this.segments = await this.transcriptService.fetchTranscript(
        this.config.youtubeUrl,
        transcriptLang
      );

      logger.info({ segmentCount: this.segments.length }, 'Transcript fetched, starting processing');

      this.isProcessing = true;
      this.currentSegmentIndex = 0;

      // Process segments sequentially
      await this.processSegments();

    } catch (error) {
      logger.error({ err: error }, 'Failed to start transcript pipeline');
      pipelineEventBus.emit('pipeline:error', error as Error, 'transcript-start');
      throw error;
    }
  }

  /**
   * Process transcript segments
   */
  private async processSegments(): Promise<void> {
    while (this.isProcessing && this.currentSegmentIndex < this.segments.length) {
      const segment = this.segments[this.currentSegmentIndex];

      if (!segment) {
        this.currentSegmentIndex++;
        continue;
      }

      try {
        await this.processSegment(segment);
        this.currentSegmentIndex++;
      } catch (error) {
        logger.error({ err: error, segmentIndex: this.currentSegmentIndex }, 'Failed to process segment');
        // Continue with next segment
        this.currentSegmentIndex++;
      }
    }

    logger.info('All transcript segments processed');
    this.isProcessing = false;
  }

  /**
   * Process a single transcript segment
   */
  private async processSegment(segment: TranscriptSegment): Promise<void> {
    try {
      this.latencyMonitor.reset();

      // No STT stage - transcription is already available!
      // Emit transcript directly
      pipelineEventBus.emit('stt:result', {
        transcript: segment.text,
        confidence: 1.0, // Transcript is assumed accurate
        isFinal: true,
        timestamp: Date.now(),
      });

      // Stage 1: Translation
      this.latencyMonitor.startStage('translation');
      const translationResult = await this.translationService.translate(segment.text);
      this.latencyMonitor.endStage('translation');

      pipelineEventBus.emit('translation:result', translationResult);

      // Stage 2: Text-to-Speech
      this.latencyMonitor.startStage('tts');
      const ttsResult = await this.ttsService.synthesize(translationResult.translatedText);
      this.latencyMonitor.endStage('tts');

      pipelineEventBus.emit('tts:result', ttsResult);

      // Emit latency metrics
      const metrics = this.latencyMonitor.calculateMetrics();
      pipelineEventBus.emit('latency:update', {
        total: metrics.translation + metrics.tts,
        capture: 0, // No capture for transcript-based
        stt: 0, // No STT for transcript-based
        translation: metrics.translation,
        tts: metrics.tts,
        output: 0,
        timestamp: Date.now(),
      });

      // Wait for segment duration before processing next
      // This syncs the output with the video timing
      await this.sleep(segment.duration * 1000);

    } catch (error) {
      logger.error({ err: error, segment }, 'Failed to process transcript segment');
      throw error;
    }
  }

  /**
   * Stop processing
   */
  async stop(): Promise<void> {
    logger.info('Stopping transcript pipeline');
    this.isProcessing = false;
    this.currentSegmentIndex = 0;
    this.segments = [];
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.isProcessing = false;
  }

  /**
   * Resume processing
   */
  resume(): void {
    if (this.currentSegmentIndex < this.segments.length) {
      this.isProcessing = true;
      this.processSegments();
    }
  }

  /**
   * Seek to a specific time in the transcript
   */
  seek(timeSeconds: number): void {
    // Find the segment closest to the requested time
    let closestIndex = 0;
    let smallestDiff = Infinity;

    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      if (!segment) continue;

      const diff = Math.abs(segment.start - timeSeconds);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestIndex = i;
      }
    }

    this.currentSegmentIndex = closestIndex;
    logger.info({ timeSeconds, segmentIndex: closestIndex }, 'Seeked to time');
  }

  /**
   * Get current progress
   */
  getProgress(): {
    currentSegment: number;
    totalSegments: number;
    currentTime: number;
    totalDuration: number;
    percentComplete: number;
  } {
    const totalDuration = this.segments.reduce((sum, s) => sum + s.duration, 0);
    const currentTime = this.segments
      .slice(0, this.currentSegmentIndex)
      .reduce((sum, s) => sum + s.duration, 0);

    return {
      currentSegment: this.currentSegmentIndex,
      totalSegments: this.segments.length,
      currentTime,
      totalDuration,
      percentComplete: this.segments.length > 0
        ? (this.currentSegmentIndex / this.segments.length) * 100
        : 0,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
