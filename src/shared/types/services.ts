/**
 * Shared types for cloud services (STT, Translation, TTS)
 */

// Speech-to-Text Types
export interface STTConfig {
  provider: 'google';
  language: string;
  sampleRate: number;
  encoding: string;
}

export interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
}

export interface STTService {
  initialize(): Promise<void>;
  transcribe(audioChunk: Buffer): Promise<STTResult>;
  close(): Promise<void>;
}

// Translation Types
export interface TranslationConfig {
  provider: 'deepl';
  sourceLanguage: string;
  targetLanguage: string;
  cacheEnabled: boolean;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
}

export interface TranslationService {
  initialize(): Promise<void>;
  translate(text: string): Promise<TranslationResult>;
  close(): Promise<void>;
}

// Text-to-Speech Types
export interface TTSConfig {
  provider: 'google';
  language: string;
  voiceName: string;
  audioEncoding: string;
  sampleRate: number;
}

export interface TTSResult {
  audioContent: Buffer;
  duration: number;
  timestamp: number;
}

export interface TTSService {
  initialize(): Promise<void>;
  synthesize(text: string): Promise<TTSResult>;
  close(): Promise<void>;
}

// Common Service Types
export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastError?: Error;
}

export type ServiceStatus = 'idle' | 'initializing' | 'ready' | 'error' | 'closed';

export interface ServiceHealth {
  status: ServiceStatus;
  metrics: ServiceMetrics;
  timestamp: number;
}
