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

    // Calculate base output directory
    const baseOutputDir = config?.outputDirectory || path.join(app.getPath('userData'), 'batch-output');

    // If collection name provided, create subdirectory
    const finalOutputDir = config?.collectionName
      ? path.join(baseOutputDir, this.sanitizeFilename(config.collectionName))
      : baseOutputDir;

    this.config = {
      segmentDuration: 30, // 30 seconds per segment
      maxConcurrentSegments: 1, // Process one at a time for now
      keepIntermediateFiles: false,
      generateVideo: true, // Generate video with French audio
      generateTranscripts: true, // Generate transcript files
      ...config,
      collectionName: config?.collectionName,
      outputDirectory: finalOutputDir, // Override to ensure it uses the calculated path
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

      // Cleanup any orphaned temp files from previous failed runs
      await this.cleanupAllTempFiles();

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

      // Step 5: Generate transcripts (optional)
      let transcriptOriginalPath: string | undefined;
      let transcriptTranslatedPath: string | undefined;

      if (this.config.generateTranscripts) {
        this.updateProgress('assembling', 'Generating transcripts', segments.length, segments.length, 97);
        const transcripts = await this.generateTranscripts(processedSegments, title);
        transcriptOriginalPath = transcripts.original;
        transcriptTranslatedPath = transcripts.translated;
        logger.info({ original: transcriptOriginalPath, translated: transcriptTranslatedPath }, 'Transcripts generated');
      }

      // Step 6: Generate video with French audio (optional)
      let finalVideoPath: string | undefined;

      if (this.config.generateVideo) {
        this.updateProgress('assembling', 'Generating video with French audio', segments.length, segments.length, 98);
        finalVideoPath = await this.generateVideoWithFrenchAudio(youtubeUrl, finalAudioPath, title);
        logger.info({ path: finalVideoPath }, 'Video with French audio generated');
      }

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
        finalVideoPath,
        transcriptOriginalPath,
        transcriptTranslatedPath,
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
   * Get audio duration using ffprobe
   */
  private async getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        audioPath,
      ]);

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          const duration = parseFloat(stdout.trim());
          resolve(duration);
        } else {
          reject(new Error(`ffprobe failed: ${stderr}`));
        }
      });

      ffprobe.on('error', reject);
    });
  }

  /**
   * Pad audio with silence to match target duration
   */
  private async padAudioWithSilence(inputPath: string, targetDuration: number, outputPath: string): Promise<void> {
    // Get current duration
    const currentDuration = await this.getAudioDuration(inputPath);

    logger.debug({ inputPath, currentDuration, targetDuration }, 'Checking audio duration for padding');

    // If already at or exceeds target duration, just copy the file
    if (currentDuration >= targetDuration - 0.1) { // 0.1s tolerance
      await fs.copyFile(inputPath, outputPath);
      logger.debug({ inputPath, outputPath }, 'Audio duration OK, no padding needed');
      return;
    }

    // Calculate silence duration needed
    const silenceDuration = targetDuration - currentDuration;

    logger.info({
      inputPath,
      currentDuration,
      targetDuration,
      silenceDuration,
      paddingPercent: ((silenceDuration / targetDuration) * 100).toFixed(1) + '%'
    }, 'Padding audio with silence');

    // Create silence file
    const silencePath = path.join(this.config.outputDirectory, `temp-silence-${Date.now()}.mp3`);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'lavfi',
        '-i', `anullsrc=r=24000:cl=mono`,
        '-t', silenceDuration.toString(),
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-y',
        silencePath,
      ]);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg silence generation failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', reject);
    });

    // Create concat file list
    const concatListPath = path.join(this.config.outputDirectory, `temp-concat-${Date.now()}.txt`);
    const concatList = `file '${inputPath.replace(/\\/g, '/')}'\nfile '${silencePath.replace(/\\/g, '/')}'`;
    await fs.writeFile(concatListPath, concatList, 'utf-8');

    // Concatenate audio + silence
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
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
    try {
      await fs.unlink(silencePath);
      await fs.unlink(concatListPath);
    } catch (error) {
      logger.warn({ err: error }, 'Failed to cleanup temp files');
    }

    logger.debug({ outputPath, finalDuration: await this.getAudioDuration(outputPath) }, 'Audio padded successfully');
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
          originalDuration: segment.duration, // Duration of original segment for sync
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

    // Write each segment to a temp file and pad with silence to match original duration
    for (let i = 0; i < sortedSegments.length; i++) {
      const segment = sortedSegments[i];

      // Write raw TTS audio to temp file
      const rawTempFile = path.join(this.config.outputDirectory, `temp-segment-raw-${i}.mp3`);
      await fs.writeFile(rawTempFile, segment.audioData);

      // Pad with silence to match original segment duration
      const paddedTempFile = path.join(this.config.outputDirectory, `temp-segment-${i}.mp3`);
      await this.padAudioWithSilence(rawTempFile, segment.originalDuration, paddedTempFile);

      tempFiles.push(paddedTempFile);

      // Cleanup raw file
      try {
        await fs.unlink(rawTempFile);
      } catch (error) {
        logger.warn({ err: error }, 'Failed to cleanup raw segment file');
      }
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
   * Generate transcript files in Markdown format
   */
  private async generateTranscripts(segments: ProcessedSegment[], title: string): Promise<{ original: string; translated: string }> {
    const sanitizedTitle = this.sanitizeFilename(title);

    // Generate original (English) transcript
    const originalContent = this.buildMarkdownTranscript(
      segments.map(s => ({ index: s.index, text: s.originalText, confidence: s.confidence })),
      title,
      'en'
    );

    const originalPath = path.join(this.config.outputDirectory, `${sanitizedTitle}_transcript_EN.md`);
    await fs.writeFile(originalPath, originalContent, 'utf-8');

    // Generate translated (French) transcript
    const translatedContent = this.buildMarkdownTranscript(
      segments.map(s => ({ index: s.index, text: s.translatedText })),
      title,
      'fr'
    );

    const translatedPath = path.join(this.config.outputDirectory, `${sanitizedTitle}_transcript_FR.md`);
    await fs.writeFile(translatedPath, translatedContent, 'utf-8');

    return { original: originalPath, translated: translatedPath };
  }

  /**
   * Build Markdown content for transcript
   */
  private buildMarkdownTranscript(
    items: Array<{ index: number; text: string; confidence?: number }>,
    title: string,
    language: 'en' | 'fr'
  ): string {
    const languageName = language === 'en' ? 'English' : 'Français';
    const timestamp = new Date().toISOString().split('T')[0];

    let markdown = `# ${title}\n\n`;
    markdown += `**Language**: ${languageName}\n`;
    markdown += `**Generated**: ${timestamp}\n`;
    markdown += `**Total Segments**: ${items.length}\n\n`;
    markdown += `---\n\n`;

    for (const item of items) {
      markdown += `## Segment ${item.index + 1}\n\n`;

      if (item.confidence !== undefined) {
        const confidencePercent = (item.confidence * 100).toFixed(1);
        markdown += `*Confidence: ${confidencePercent}%*\n\n`;
      }

      markdown += `${item.text}\n\n`;
      markdown += `---\n\n`;
    }

    // Add footer
    markdown += `\n\n---\n\n`;
    markdown += `*Generated by YouTube Live Translator*\n`;
    markdown += `*Powered by Google Cloud STT, DeepL Translation, and Google Cloud TTS*\n`;

    return markdown;
  }

  /**
   * Generate video with French audio
   */
  private async generateVideoWithFrenchAudio(youtubeUrl: string, frenchAudioPath: string, title: string): Promise<string> {
    const sanitizedTitle = this.sanitizeFilename(title);

    // Step 1: Download full video (not just audio)
    const videoPath = await this.downloadFullVideo(youtubeUrl);
    logger.info({ path: videoPath }, 'Full video downloaded');

    // Step 2: Merge video with French audio using ffmpeg
    const outputPath = path.join(this.config.outputDirectory, `${sanitizedTitle}_FR.mp4`);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,           // Input: Original video
        '-i', frenchAudioPath,     // Input: French audio
        '-c:v', 'copy',            // Copy video stream (no re-encoding)
        '-c:a', 'aac',             // Encode audio to AAC
        '-b:a', '192k',            // Audio bitrate
        '-map', '0:v:0',           // Map video from first input
        '-map', '1:a:0',           // Map audio from second input
        '-shortest',               // End at shortest stream
        '-y',                      // Overwrite output
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
          reject(new Error(`ffmpeg video merge failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', reject);
    });

    // Cleanup downloaded video
    try {
      await fs.unlink(videoPath);
    } catch (error) {
      logger.warn({ err: error }, 'Failed to cleanup downloaded video');
    }

    return outputPath;
  }

  /**
   * Download full video (video + audio) from YouTube
   */
  private async downloadFullVideo(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(this.config.outputDirectory, `temp-video-${Date.now()}.mp4`);
      const ytdlpPath = getYtDlpPath();

      // Download best video+audio merged format
      const ytdlp = spawn(ytdlpPath, [
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '-o', outputPath,
        '--no-playlist',
        '--merge-output-format', 'mp4',
        url,
      ]);

      let stderr = '';

      ytdlp.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        logger.debug({ stderr: error }, 'yt-dlp video stderr');
      });

      ytdlp.on('close', async (code) => {
        if (code === 0) {
          try {
            const stats = await fs.stat(outputPath);
            if (stats.size === 0) {
              reject(new Error('yt-dlp downloaded empty video file'));
              return;
            }
            logger.info({ outputPath, fileSize: stats.size }, 'yt-dlp video download successful');
            resolve(outputPath);
          } catch (error) {
            reject(new Error(`yt-dlp succeeded but video file not found: ${outputPath}`));
          }
        } else {
          reject(new Error(`yt-dlp video download failed (exit code ${code}): ${stderr}`));
        }
      });

      ytdlp.on('error', (error) => {
        logger.error({ err: error, ytdlpPath }, 'yt-dlp video spawn error');
        reject(error);
      });
    });
  }

  /**
   * Cleanup all temporary files in the output directory
   */
  private async cleanupAllTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.outputDirectory);

      // Patterns for temporary files to clean up
      const tempPatterns = [
        /^temp-.*\.(m4a|mp4|mp3|txt)$/, // temp-*.m4a, temp-*.mp4, temp-*.mp3, temp-*.txt
        /^segment-\d+\.pcm$/, // segment-N.pcm
        /^filelist\.txt$/, // filelist.txt
      ];

      const filesToDelete = files.filter(file =>
        tempPatterns.some(pattern => pattern.test(file))
      );

      if (filesToDelete.length > 0) {
        logger.info({ count: filesToDelete.length, files: filesToDelete }, 'Cleaning up temporary files');

        await Promise.allSettled(
          filesToDelete.map(file =>
            fs.unlink(path.join(this.config.outputDirectory, file))
          )
        );

        logger.info({ cleaned: filesToDelete.length }, 'Temporary files cleanup completed');
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to cleanup temporary files');
    }
  }

  /**
   * Cleanup intermediate files for a specific processing run
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
