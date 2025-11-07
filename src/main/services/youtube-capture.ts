/**
 * YouTube Audio Capture Service
 * Extracts audio stream from YouTube videos using yt-dlp
 */
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Readable } from 'stream';
import { createComponentLogger } from '@main/utils/logger';
import path from 'path';

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
  private process: ChildProcessWithoutNullStreams | null = null;
  private ytDlpProcess: ChildProcessWithoutNullStreams | null = null;
  private stream: Readable | null = null;
  private options: YouTubeCaptureOptions;
  private isCapturing = false;
  private sequenceNumber = 0;

  constructor(options: YouTubeCaptureOptions) {
    this.options = options;
  }

  /**
   * Start capturing audio from YouTube using yt-dlp
   */
  async start(onChunk: (chunk: AudioChunk) => void): Promise<void> {
    if (this.isCapturing) {
      throw new Error('Already capturing');
    }

    logger.info({ url: this.options.url }, 'Starting YouTube audio capture with yt-dlp');

    try {
      // Get yt-dlp path (assume it's in project root or PATH)
      const ytDlpPath = process.env.YTDLP_PATH || path.join(process.cwd(), 'resources', 'yt-dlp.exe');

      // First, get video info
      const infoProcess = spawn(ytDlpPath, ['--dump-json', this.options.url]);

      let infoData = '';
      infoProcess.stdout.on('data', (chunk) => {
        infoData += chunk.toString();
      });

      await new Promise<void>((resolve, reject) => {
        infoProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`yt-dlp info failed with code ${code}`));
          } else {
            try {
              const info = JSON.parse(infoData);
              logger.info(
                {
                  title: info.title,
                  duration: info.duration,
                  isLive: info.is_live || false,
                },
                'Video info retrieved'
              );
              resolve();
            } catch (err) {
              reject(new Error('Failed to parse video info'));
            }
          }
        });
      });

      // Start streaming audio with ffmpeg conversion
      const format = this.options.quality === 'highest' ? 'bestaudio' : 'worstaudio';
      const ffmpegPath = process.env.FFMPEG_PATH || path.join(process.cwd(), 'resources', 'ffmpeg', 'bin', 'ffmpeg.exe');
      
      // yt-dlp: Download audio
      this.ytDlpProcess = spawn(ytDlpPath, [
        '-f', format,
        '-o', '-',           // Output to stdout
        '--no-playlist',     // Don't download playlists
        '--quiet',           // Suppress output
        '--no-warnings',     // Suppress warnings
        this.options.url,
      ]);

      // ffmpeg: Convert to LINEAR16 PCM 16kHz mono for Google Cloud STT
      this.process = spawn(ffmpegPath, [
        '-i', 'pipe:0',               // Input from stdin
        '-f', 's16le',                // Format: signed 16-bit little-endian
        '-acodec', 'pcm_s16le',       // Codec: PCM signed 16-bit
        '-ar', '16000',               // Sample rate: 16kHz (required by Google STT)
        '-ac', '1',                   // Audio channels: 1 (mono)
        '-'                           // Output to stdout
      ]);

      // Pipe yt-dlp stdout to ffmpeg stdin
      this.ytDlpProcess.stdout.pipe(this.process.stdin);

      // Handle yt-dlp errors
      this.ytDlpProcess.stderr?.on('data', (data) => {
        logger.warn({ stderr: data.toString() }, 'yt-dlp stderr');
      });

      this.ytDlpProcess.on('error', (error) => {
        logger.error({ err: error }, 'yt-dlp process error');
        this.stop();
      });

      this.stream = this.process.stdout;
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

      this.stream.on('error', (error) => {
        logger.error({ err: error }, 'YouTube stream error');
        this.stop();
      });

      this.stream.on('end', () => {
        logger.info('YouTube stream ended');
        this.stop();
      });

      // Handle process errors
      this.process.stderr?.on('data', (data) => {
        logger.warn({ stderr: data.toString() }, 'yt-dlp stderr');
      });

      this.process.on('error', (error) => {
        logger.error({ err: error }, 'yt-dlp process error');
        this.stop();
      });

      this.process.on('exit', (code) => {
        if (code !== 0 && this.isCapturing) {
          logger.error({ code }, 'yt-dlp process exited with error');
          this.stop();
        }
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

    // Kill ytdl-p process
    if (this.ytDlpProcess) {
      this.ytDlpProcess.kill('SIGTERM');
      this.ytDlpProcess = null;
    }

    // Kill ffmpeg process
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }

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
