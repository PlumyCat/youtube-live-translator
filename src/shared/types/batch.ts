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
  duration: number;
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
  processingTime: number; // in milliseconds
  error?: Error;
}

export interface BatchConfig {
  segmentDuration: number; // Duration of each segment in seconds (default: 30)
  maxConcurrentSegments: number; // Max segments to process in parallel (default: 1)
  outputDirectory: string;
  keepIntermediateFiles: boolean;
}
