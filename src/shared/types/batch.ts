/**
 * Types for Batch Processing
 */

export type BatchStatus = 'idle' | 'downloading' | 'segmenting' | 'processing' | 'assembling' | 'completed' | 'error';

export interface VideoSegment {
  index: number;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  audioData: Buffer;
  duration: number;  // in seconds
}

export interface ProcessedSegment {
  index: number;
  originalText: string;
  translatedText: string;
  audioData: Buffer;
  confidence: number;
  duration: number; // Duration of TTS audio
  originalDuration: number; // Duration of original segment (for sync)
}

export interface BatchProgress {
  status: BatchStatus;
  phase: string;
  currentSegment: number;
  totalSegments: number;
  percentage: number;
  message: string;
  estimatedTimeRemaining?: number; // in seconds
}

export interface BatchResult {
  success: boolean;
  videoTitle: string;
  videoDuration: number;
  totalSegments: number;
  processedSegments: ProcessedSegment[];
  finalAudioPath: string;
  finalVideoPath?: string; // Video with French audio
  transcriptOriginalPath?: string; // Original English transcript (Markdown)
  transcriptOriginalPdfPath?: string; // Original English transcript (PDF)
  transcriptTranslatedPath?: string; // Translated French transcript (Markdown)
  transcriptTranslatedPdfPath?: string; // Translated French transcript (PDF)
  processingTime: number; // in milliseconds
  error?: Error;
}

export interface BatchConfig {
  segmentDuration: number; // Duration of each segment in seconds (default: 30)
  maxConcurrentSegments: number; // Max segments to process in parallel (default: 1)
  outputDirectory: string;
  collectionName?: string; // Optional: Group videos in a collection folder
  keepIntermediateFiles: boolean;
  generateVideo: boolean; // Generate video with French audio (default: true)
  generateTranscripts: boolean; // Generate transcript files (default: true)
}
