/**
 * Pipeline and audio processing types
 */

export type PipelineStatus = 'idle' | 'starting' | 'running' | 'paused' | 'stopping' | 'error';

export interface PipelineConfig {
  youtubeUrl: string;
  sttLanguage: string;
  targetLanguage: string;
  targetLatency: number;
  audioChunkDuration: number;
}

export interface LatencyMetrics {
  total: number;
  capture: number;
  stt: number;
  translation: number;
  tts: number;
  output: number;
  timestamp: number;
}

export interface PipelineEvent {
  type: 'status' | 'latency' | 'transcript' | 'translation' | 'error';
  timestamp: number;
  data: unknown;
}

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  sequence: number;
}
