/**
 * Shared types for cloud services (STT, Translation, TTS)
 */

// Provider Types
export type STTProvider = 'google' | 'azure' | 'whisper';
export type TranslationProvider = 'deepl' | 'azure' | 'google';
export type TTSProvider = 'google' | 'azure' | 'elevenlabs';

// Voice Gender for TTS
export type VoiceGender = 'male' | 'female' | 'neutral';

// Speech-to-Text Types
export interface STTConfig {
  provider: STTProvider;
  language: string;
  sampleRate: number;
  encoding: string;
  // Azure-specific
  azureKey?: string;
  azureRegion?: string;
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
  getMetrics(): ServiceMetrics;
}

// Translation Types
export interface TranslationConfig {
  provider: TranslationProvider;
  sourceLanguage: string;
  targetLanguage: string;
  cacheEnabled: boolean;
  // Azure-specific
  azureKey?: string;
  azureRegion?: string;
  azureEndpoint?: string;
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
  getMetrics(): ServiceMetrics;
}

// Text-to-Speech Types
export interface TTSConfig {
  provider: TTSProvider;
  language: string;
  voiceName: string;
  voiceGender?: VoiceGender; // NEW: Gender selection
  audioEncoding: string;
  sampleRate: number;
  // Azure-specific
  azureKey?: string;
  azureRegion?: string;
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

export interface TTSService {
  initialize(): Promise<void>;
  synthesize(text: string): Promise<TTSResult>;
  close(): Promise<void>;
  getMetrics(): ServiceMetrics;
}

// Service Configuration (for Settings)
export interface ServiceConfig {
  // Provider selection
  providers: {
    stt: STTProvider;
    translation: TranslationProvider;
    tts: TTSProvider;
  };
  // Google Cloud
  googleCloud: {
    projectId: string;
    keyFilePath: string;
  };
  // DeepL
  deepl: {
    apiKey: string;
  };
  // Azure
  azure: {
    speechKey: string;
    speechRegion: string;
    translatorKey: string;
    translatorRegion: string;
    translatorEndpoint: string;
  };
  // Voice settings
  voice: {
    gender: VoiceGender;
    name?: string; // Optional custom voice name
  };
}

export type PartialServiceConfig = {
  providers?: {
    stt?: STTProvider;
    translation?: TranslationProvider;
    tts?: TTSProvider;
  };
  googleCloud?: {
    projectId?: string;
    keyFilePath?: string;
  };
  deepl?: {
    apiKey?: string;
  };
  azure?: {
    speechKey?: string;
    speechRegion?: string;
    translatorKey?: string;
    translatorRegion?: string;
    translatorEndpoint?: string;
  };
  voice?: {
    gender?: VoiceGender;
    name?: string;
  };
};
