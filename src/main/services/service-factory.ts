/**
 * Service Factory
 * Creates appropriate service instances based on provider configuration
 */
import type {
  STTService,
  TTSService,
  TranslationService,
  STTConfig,
  TTSConfig,
  TranslationConfig,
} from '@shared/types/services';
import { GoogleCloudSTTService } from './stt-service';
import { GoogleCloudTTSService } from './tts-service';
import { DeepLTranslationService } from './translation-service';
import { AzureSpeechSTTService } from './azure-stt-service';
import { AzureSpeechTTSService } from './azure-tts-service';
import { AzureTranslatorService } from './azure-translator-service';
import { createComponentLogger } from '@main/utils/logger';

const logger = createComponentLogger('ServiceFactory');

/**
 * Create STT service based on provider
 */
export function createSTTService(config: STTConfig): STTService {
  logger.info({ provider: config.provider }, 'Creating STT service');

  switch (config.provider) {
    case 'google':
      return new GoogleCloudSTTService(config);
    case 'azure':
      return new AzureSpeechSTTService(config);
    case 'whisper':
      throw new Error('Whisper STT provider not yet implemented');
    default:
      throw new Error(`Unknown STT provider: ${config.provider}`);
  }
}

/**
 * Create TTS service based on provider
 */
export function createTTSService(config: TTSConfig): TTSService {
  logger.info({
    provider: config.provider,
    voiceGender: config.voiceGender,
  }, 'Creating TTS service');

  switch (config.provider) {
    case 'google':
      return new GoogleCloudTTSService(config);
    case 'azure':
      return new AzureSpeechTTSService(config);
    case 'elevenlabs':
      throw new Error('ElevenLabs TTS provider not yet implemented');
    default:
      throw new Error(`Unknown TTS provider: ${config.provider}`);
  }
}

/**
 * Create Translation service based on provider
 */
export function createTranslationService(
  config: TranslationConfig
): TranslationService {
  logger.info({ provider: config.provider }, 'Creating Translation service');

  switch (config.provider) {
    case 'deepl':
      return new DeepLTranslationService(config);
    case 'azure':
      return new AzureTranslatorService(config);
    case 'google':
      throw new Error('Google Cloud Translation provider not yet implemented');
    default:
      throw new Error(`Unknown Translation provider: ${config.provider}`);
  }
}

/**
 * Load service configuration from environment
 */
export function loadServiceConfigFromEnv(): {
  sttProvider: STTConfig['provider'];
  ttsProvider: TTSConfig['provider'];
  translationProvider: TranslationConfig['provider'];
} {
  return {
    sttProvider: (process.env.STT_PROVIDER as STTConfig['provider']) || 'google',
    ttsProvider: (process.env.TTS_PROVIDER as TTSConfig['provider']) || 'google',
    translationProvider:
      (process.env.TRANSLATION_PROVIDER as TranslationConfig['provider']) || 'deepl',
  };
}
