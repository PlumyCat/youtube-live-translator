/**
 * Service configuration from environment variables
 */
import type { STTConfig, TranslationConfig, TTSConfig } from '@shared/types/services';
import { z } from 'zod';

// Validation schemas
const STTConfigSchema = z.object({
  provider: z.literal('google'),
  language: z.string().default('en-US'),
  sampleRate: z.number().default(16000),
  encoding: z.string().default('LINEAR16'),
});

const TranslationConfigSchema = z.object({
  provider: z.literal('deepl'),
  sourceLanguage: z.string().default('en'),
  targetLanguage: z.string().default('fr'),
  cacheEnabled: z.boolean().default(true),
});

const TTSConfigSchema = z.object({
  provider: z.literal('google'),
  language: z.string().default('fr-FR'),
  voiceName: z.string().default('fr-FR-Neural2-A'),
  audioEncoding: z.string().default('LINEAR16'),
  sampleRate: z.number().default(24000),
});

/**
 * Load STT configuration from environment
 */
export function loadSTTConfig(): STTConfig {
  const config = {
    provider: 'google' as const,
    language: process.env.STT_LANGUAGE || 'en-US',
    sampleRate: parseInt(process.env.STT_SAMPLE_RATE || '16000', 10),
    encoding: process.env.STT_ENCODING || 'LINEAR16',
  };

  return STTConfigSchema.parse(config);
}

/**
 * Load Translation configuration from environment
 */
export function loadTranslationConfig(): TranslationConfig {
  const config = {
    provider: 'deepl' as const,
    sourceLanguage: process.env.SOURCE_LANGUAGE || 'en',
    targetLanguage: process.env.TARGET_LANGUAGE || 'fr',
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
  };

  return TranslationConfigSchema.parse(config);
}

/**
 * Load TTS configuration from environment
 */
export function loadTTSConfig(): TTSConfig {
  const config = {
    provider: 'google' as const,
    language: process.env.TTS_LANGUAGE || 'fr-FR',
    voiceName: process.env.TTS_VOICE_NAME || 'fr-FR-Neural2-A',
    audioEncoding: process.env.TTS_ENCODING || 'LINEAR16',
    sampleRate: parseInt(process.env.TTS_SAMPLE_RATE || '24000', 10),
  };

  return TTSConfigSchema.parse(config);
}

/**
 * Validate that required environment variables are set
 */
export function validateEnvironment(): void {
  const required = ['GOOGLE_APPLICATION_CREDENTIALS', 'DEEPL_API_KEY'];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
