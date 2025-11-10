/**
 * Batch Video Processor
 * Downloads YouTube video, segments it, processes each segment, and assembles final output
 */
import { createComponentLogger } from '@main/utils/logger';
import { EventEmitter } from 'events';
import type {
  BatchStatus,
  BatchProgress,
  BatchResult,
  BatchConfig,
  VideoSegment,
  ProcessedSegment,
} from '@shared/types/batch';
import type { GoogleCloudSTTService } from './stt-service';
import type { DeepLTranslationService } from './translation-service';
import type { GoogleCloudTTSService } from './tts-service';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { fileURLToPath } from 'url';

const logger = createComponentLogger('BatchVideoProcessor');

/**
 * Get the path to yt-dlp executable
 */
function getYtDlpPath(): string {
  // In development, use the bin directory from app path
  if (process.env.NODE_ENV === 'development') {
    // Use app.getAppPath() which gives the project root
    const appPath = app.getAppPath();
    const ytdlpPath = path.join(appPath, 'bin', 'yt-dlp.exe');
    logger.debug({ appPath, ytdlpPath }, 'Resolving yt-dlp path');
    return ytdlpPath;
  }

  // In production, yt-dlp should be bundled or in PATH
  return 'yt-dlp';
}

export class BatchVideoProcessor extends EventEmitter {
  private config: BatchConfig;
  private status: BatchStatus = 'idle';
  private currentProgress: BatchProgress = {
    status: 'idle',
    phase: 'Waiting to start',
    currentSegment: 0,
    totalSegments: 0,
    percentage: 0,
    message: 'Ready',
  };

  constructor(
    private sttService: GoogleCloudSTTService,
    private translationService: DeepLTranslationService,
    private ttsService: GoogleCloudTTSService,
    config?: Partial<BatchConfig>
  ) {
    super();
    this.config = {
      segmentDuration: 30, // 30 seconds per segment
      maxConcurrentSegments: 1, // Process one at a time for now
      outputDirectory: path.join(app.getPath('userData'), 'batch-output'),
      keepIntermediateFiles: false,
      ...config,
    };
  }

  /**
   * Process a YouTube video in batch mode
   */
  async processVideo(youtubeUrl: string): Promise<BatchResult> {
    const startTime = Date.now();

    try {
      // Ensure output directory exists
      await fs.mkdir(this.config.outputDirectory, { recursive: true });

      // Step 1: Download video
      this.updateProgress('downloading', 'Downloading video', 0, 0, 5);
      const { videoPath, title, duration } = await this.downloadVideo(youtubeUrl);
      logger.info({ title, duration }, 'Video downloaded');

      // Step 2: Segment video
      this.updateProgress('segmenting', 'Segmenting audio', 0, 0, 15);
      const segments = await this.segmentAudio(videoPath, duration);
      logger.info({ totalSegments: segments.length }, 'Audio segmented');

      // Step 3: Process segments
      this.updateProgress('processing', 'Processing segments', 0, segments.length, 20);
      const processedSegments = await this.processSegments(segments);
      logger.info({ processedCount: processedSegments.length }, 'Segments processed');

      // Step 4: Assemble final audio
      this.updateProgress('assembling', 'Assembling final audio', segments.length, segments.length, 95);
      const finalAudioPath = await this.assembleFinalAudio(processedSegments, title);
      logger.info({ path: finalAudioPath }, 'Final audio assembled');

      // Cleanup
      if (!this.config.keepIntermediateFiles) {
        await this.cleanup(videoPath, segments, processedSegments);
      }

      const result: BatchResult = {
        success: true,
        videoTitle: title,
        videoDuration: duration,
        totalSegments: segments.length,
        processedSegments,
        finalAudioPath,
        processingTime: Date.now() - startTime,
      };

      this.updateProgress('completed', 'Processing complete', segments.length, segments.length, 100);
      this.emit('completed', result);

      return result;

    } catch (error) {
      logger.error({ err: error }, 'Batch processing failed');
      this.status = 'error';
      this.emit('error', error);

      throw error;
    }
  }

  /**
   * Download YouTube video audio
   */
  private async downloadVideo(url: string): Promise<{ videoPath: string; title: string; duration: number }> {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(this.config.outputDirectory, `temp-${Date.now()}.m4a`);

      const ytdlpPath = getYtDlpPath();
      logger.info({ ytdlpPath }, 'Using yt-dlp at path');

      // Use yt-dlp to download audio with options to bypass restrictions
      const ytdlp = spawn(ytdlpPath, [
        '-f', 'bestaudio/best',
        '-o', outputPath,
        '--print', 'after_move:title',
        '--print', 'after_move:duration',
        '--no-playlist',
        '--extract-audio',
        '--audio-format', 'm4a',
        '--no-check-certificates',
        url,
      ]);

      let metadata = '';
      let stderr = '';

      ytdlp.stdout.on('data', (data) => {
        const output = data.toString();
        metadata += output;
        logger.debug({ output }, 'yt-dlp stdout');
      });

      ytdlp.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        logger.warn({ stderr: error }, 'yt-dlp stderr');
      });

      ytdlp.on('close', async (code) => {
        if (code === 0) {
          const lines = metadata.trim().split('\n');
          const title = lines[0] || 'Unknown';
          const duration = parseInt(lines[1] || '0', 10);

          // Verify the file actually exists
          try {
            const stats = await fs.stat(outputPath);
            if (stats.size === 0) {
              logger.error({ outputPath, size: stats.size }, 'yt-dlp downloaded empty file');
              reject(new Error('yt-dlp downloaded empty file'));
              return;
            }
            logger.info({ title, duration, outputPath, fileSize: stats.size }, 'yt-dlp download successful');
            resolve({ videoPath: outputPath, title, duration });
          } catch (error) {
            logger.error({ err: error, outputPath, stderr }, 'Downloaded file does not exist');
            reject(new Error(`yt-dlp succeeded but file not found: ${outputPath}. This may be due to YouTube restrictions. Error: ${stderr}`));
          }
        } else {
          logger.error({ code, stderr, metadata, outputPath }, 'yt-dlp failed with non-zero exit code');
          reject(new Error(`yt-dlp failed (exit code ${code}): ${stderr || 'No error message'}`));
        }
      });

      ytdlp.on('error', (error) => {
        logger.error({ err: error, ytdlpPath }, 'yt-dlp spawn error');
        reject(error);
      });
    });
  }

  /**
   * Segment audio into chunks
   */
  private async segmentAudio(videoPath: string, totalDuration: number): Promise<VideoSegment[]> {
    const segments: VideoSegment[] = [];
    const segmentDuration = this.config.segmentDuration;
    const numSegments = Math.ceil(totalDuration / segmentDuration);

    for (let i = 0; i < numSegments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, totalDuration);
      const duration = endTime - startTime;

      // Extract segment using ffmpeg
      const segmentPath = path.join(this.config.outputDirectory, `segment-${i}.pcm`);
      await this.extractSegment(videoPath, startTime, duration, segmentPath);

      const audioData = await fs.readFile(segmentPath);

      segments.push({
        index: i,
        startTime,
        endTime,
        audioData,
        duration,
      });

      // Update progress
      this.updateProgress('segmenting', `Segmenting audio (${i + 1}/${numSegments})`, i + 1, numSegments, 15 + (i / numSegments) * 5);
    }

    return segments;
  }

  /**
   * Extract a segment using ffmpeg
   */
  private async extractSegment(inputPath: string, startTime: number, duration: number, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-i', inputPath,
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-y',
        outputPath,
      ]);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Process all segments
   */
  private async processSegments(segments: VideoSegment[]): Promise<ProcessedSegment[]> {
    const processed: ProcessedSegment[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      this.updateProgress(
        'processing',
        `Processing segment ${i + 1}/${segments.length}`,
        i,
        segments.length,
        20 + ((i / segments.length) * 75)
      );

      try {
        // Step 1: STT
        logger.info({ segment: i + 1, audioDataSize: segment.audioData.length }, 'Running STT...');
        const sttResult = await this.sttService.transcribe(segment.audioData);

        // Log detailed STT result
        logger.info({
          segment: i + 1,
          sttResult: {
            transcript: sttResult.transcript,
            confidence: sttResult.confidence,
            hasTranscript: !!sttResult.transcript,
            transcriptLength: sttResult.transcript?.length || 0,
          }
        }, 'STT result received');

        // If no transcript, skip this segment
        if (!sttResult.transcript) {
          logger.warn({ segment: i + 1 }, 'No transcript for segment, skipping');
          continue;
        }

        // Step 2: Translation
        logger.info({ segment: i + 1, text: sttResult.transcript }, 'Translating...');
        const translationResult = await this.translationService.translate(sttResult.transcript);

        // Step 3: TTS
        logger.info({ segment: i + 1, translatedText: translationResult.translatedText }, 'Generating audio...');
        const ttsResult = await this.ttsService.synthesize(translationResult.translatedText);

        processed.push({
          index: segment.index,
          originalText: sttResult.transcript,
          translatedText: translationResult.translatedText,
          audioData: ttsResult.audioContent,
          confidence: sttResult.confidence,
          duration: ttsResult.duration,
        });

        logger.info({ segment: i + 1, confidence: sttResult.confidence }, 'Segment processed successfully');

      } catch (error) {
        logger.error({ err: error, segment: i + 1 }, 'Failed to process segment');
        // Continue with next segment
      }
    }

    return processed;
  }

  /**
   * Assemble final audio from processed segments
   */
  private async assembleFinalAudio(segments: ProcessedSegment[], title: string): Promise<string> {
    // Check if we have any segments to process
    if (segments.length === 0) {
      throw new Error('No segments were processed. STT may not have detected any speech in the audio. Please try a video with clearer speech or check your Google Cloud STT configuration.');
    }

    // Sort segments by index
    const sortedSegments = segments.sort((a, b) => a.index - b.index);

    // For MP3 output, we need to concatenate the audio files
    const outputPath = path.join(this.config.outputDirectory, `${this.sanitizeFilename(title)}_fr.mp3`);

    // Create a file list for ffmpeg
    const fileListPath = path.join(this.config.outputDirectory, 'filelist.txt');
    const tempFiles: string[] = [];

    // Write each segment to a temp file
    for (let i = 0; i < sortedSegments.length; i++) {
      const tempFile = path.join(this.config.outputDirectory, `temp-segment-${i}.mp3`);
      await fs.writeFile(tempFile, sortedSegments[i].audioData);
      tempFiles.push(tempFile);
    }

    // Create file list for ffmpeg concat
    const fileList = tempFiles.map(f => `file '${f}'`).join('\n');
    await fs.writeFile(fileListPath, fileList);

    // Concatenate using ffmpeg (re-encode to ensure compatibility)
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', fileListPath,
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-ar', '24000',
        '-y',
        outputPath,
      ]);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg concat failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', reject);
    });

    // Cleanup temp files
    await Promise.all([
      fs.unlink(fileListPath),
      ...tempFiles.map(f => fs.unlink(f)),
    ]);

    return outputPath;
  }

  /**
   * Cleanup intermediate files
   */
  private async cleanup(videoPath: string, segments: VideoSegment[], processed: ProcessedSegment[]): Promise<void> {
    try {
      // Delete original video
      await fs.unlink(videoPath);

      // Delete segment files
      for (let i = 0; i < segments.length; i++) {
        const segmentPath = path.join(this.config.outputDirectory, `segment-${i}.pcm`);
        try {
          await fs.unlink(segmentPath);
        } catch {
          // Ignore if file doesn't exist
        }
      }

      logger.info('Cleanup completed');
    } catch (error) {
      logger.error({ err: error }, 'Cleanup failed');
    }
  }

  /**
   * Update progress and emit event
   */
  private updateProgress(
    status: BatchStatus,
    phase: string,
    current: number,
    total: number,
    percentage: number,
    message?: string
  ): void {
    this.status = status;
    this.currentProgress = {
      status,
      phase,
      currentSegment: current,
      totalSegments: total,
      percentage: Math.min(100, Math.max(0, percentage)),
      message: message || phase,
    };

    this.emit('progress', this.currentProgress);
    logger.info(this.currentProgress, 'Progress update');
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
      .substring(0, 50);
  }

  /**
   * Get current progress
   */
  getProgress(): BatchProgress {
    return this.currentProgress;
  }

  /**
   * Get status
   */
  getStatus(): BatchStatus {
    return this.status;
  }
}
