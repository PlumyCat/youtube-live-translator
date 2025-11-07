/**
 * YouTube Audio Capture Service
 * Extracts audio stream from YouTube videos using ytdl-core
 */
import ytdl from '@distube/ytdl-core';
import { Readable } from 'stream';
import { createComponentLogger } from '@main/utils/logger';

const logger = createComponentLogger('YouTubeCapture');

export interface YouTubeCaptureOptions {
  url: string;
  quality: 'lowest' | 'highest';
  chunkDuration: number; // milliseconds
}

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  sequence: number;
}

/**
 * YouTube Audio Capture Service
 */
export class YouTubeCaptureService {
  private stream: Readable | null = null;
  private options: YouTubeCaptureOptions;
  private isCapturing = false;
  private sequenceNumber = 0;

  constructor(options: YouTubeCaptureOptions) {
    this.options = options;
  }

  /**
   * Start capturing audio from YouTube
   */
  async start(onChunk: (chunk: AudioChunk) => void): Promise<void> {
    if (this.isCapturing) {
      throw new Error('Already capturing');
    }

    logger.info({ url: this.options.url }, 'Starting YouTube audio capture');

    try {
      // Validate YouTube URL
      if (!ytdl.validateURL(this.options.url)) {
        throw new Error('Invalid YouTube URL');
      }

      // Get video info
      const info = await ytdl.getInfo(this.options.url);
      logger.info(
        {
          title: info.videoDetails.title,
          duration: info.videoDetails.lengthSeconds,
          isLive: info.videoDetails.isLiveContent,
        },
        'Video info retrieved'
      );

      // Create audio stream with highest quality audio only
      this.stream = ytdl(this.options.url, {
        quality: this.options.quality,
        filter: 'audioonly',
        highWaterMark: 1 << 25, // 32MB buffer
      });

      this.isCapturing = true;
      this.sequenceNumber = 0;

      // Handle stream events
      this.stream.on('data', (chunk: Buffer) => {
        if (!this.isCapturing) return;

        const audioChunk: AudioChunk = {
          data: chunk,
          timestamp: Date.now(),
          sequence: this.sequenceNumber++,
        };

        onChunk(audioChunk);

        logger.debug(
          {
            size: chunk.length,
            sequence: audioChunk.sequence,
          },
          'Audio chunk received'
        );
      });

      this.stream.on('error', error => {
        logger.error({ err: error }, 'YouTube stream error');
        this.stop();
      });

      this.stream.on('end', () => {
        logger.info('YouTube stream ended');
        this.stop();
      });
    } catch (error) {
      this.isCapturing = false;
      logger.error({ err: error }, 'Failed to start YouTube capture');
      throw error;
    }
  }

  /**
   * Stop capturing
   */
  stop(): void {
    if (!this.isCapturing) return;

    logger.info('Stopping YouTube audio capture');
    this.isCapturing = false;

    if (this.stream) {
      this.stream.destroy();
      this.stream = null;
    }

    this.sequenceNumber = 0;
  }

  /**
   * Check if currently capturing
   */
  isActive(): boolean {
    return this.isCapturing;
  }

  /**
   * Get current sequence number
   */
  getSequenceNumber(): number {
    return this.sequenceNumber;
  }
}
