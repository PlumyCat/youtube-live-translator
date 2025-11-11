/**
 * Azure Text-to-Speech Service
 * Using Azure Cognitive Services Speech SDK
 * Supports voice gender selection (male/female/neutral)
 */
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import type {
  TTSConfig,
  TTSResult,
  TTSService,
  ServiceMetrics,
  VoiceGender,
} from '@shared/types/services';
import { createComponentLogger, logAPICall } from '@main/utils/logger';
import { CircuitBreaker } from '@main/utils/circuit-breaker';

const logger = createComponentLogger('AzureTTSService');

/**
 * Azure Neural Voices by language and gender
 * https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
 */
const AZURE_VOICES: Record<
  string,
  Record<VoiceGender, string>
> = {
  // French
  'fr-FR': {
    male: 'fr-FR-HenriNeural',
    female: 'fr-FR-DeniseNeural',
    neutral: 'fr-FR-DeniseNeural',
  },
  // English US
  'en-US': {
    male: 'en-US-GuyNeural',
    female: 'en-US-JennyNeural',
    neutral: 'en-US-AriaNeural',
  },
  // English UK
  'en-GB': {
    male: 'en-GB-RyanNeural',
    female: 'en-GB-SoniaNeural',
    neutral: 'en-GB-LibbyNeural',
  },
  // Spanish
  'es-ES': {
    male: 'es-ES-AlvaroNeural',
    female: 'es-ES-ElviraNeural',
    neutral: 'es-ES-ElviraNeural',
  },
  // German
  'de-DE': {
    male: 'de-DE-ConradNeural',
    female: 'de-DE-KatjaNeural',
    neutral: 'de-DE-KatjaNeural',
  },
  // Italian
  'it-IT': {
    male: 'it-IT-DiegoNeural',
    female: 'it-IT-ElsaNeural',
    neutral: 'it-IT-ElsaNeural',
  },
  // Portuguese (Brazil)
  'pt-BR': {
    male: 'pt-BR-AntonioNeural',
    female: 'pt-BR-FranciscaNeural',
    neutral: 'pt-BR-FranciscaNeural',
  },
  // Japanese
  'ja-JP': {
    male: 'ja-JP-KeitaNeural',
    female: 'ja-JP-NanamiNeural',
    neutral: 'ja-JP-NanamiNeural',
  },
  // Korean
  'ko-KR': {
    male: 'ko-KR-InJoonNeural',
    female: 'ko-KR-SunHiNeural',
    neutral: 'ko-KR-SunHiNeural',
  },
  // Chinese (Simplified)
  'zh-CN': {
    male: 'zh-CN-YunxiNeural',
    female: 'zh-CN-XiaoxiaoNeural',
    neutral: 'zh-CN-XiaoxiaoNeural',
  },
};

export class AzureSpeechTTSService implements TTSService {
  private synthesizer: sdk.SpeechSynthesizer | null = null;
  private config: TTSConfig;
  private circuitBreaker: CircuitBreaker;
  private metrics: ServiceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
  };

  constructor(config: TTSConfig) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker('AzureSpeechTTS', {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Azure Text-to-Speech service');

    try {
      if (!this.config.azureKey || !this.config.azureRegion) {
        throw new Error('Azure Speech credentials not configured');
      }

      // Create speech config
      const speechConfig = sdk.SpeechConfig.fromSubscription(
        this.config.azureKey,
        this.config.azureRegion
      );

      // Select voice based on language and gender
      const voiceName = this.selectVoice(
        this.config.language,
        this.config.voiceGender || 'female'
      );
      speechConfig.speechSynthesisVoiceName = voiceName;

      // Set audio format
      speechConfig.speechSynthesisOutputFormat =
        sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

      // Create synthesizer with null output (we'll get audio from result)
      this.synthesizer = new sdk.SpeechSynthesizer(speechConfig, null as any);

      logger.info({
        language: this.config.language,
        voiceName,
        voiceGender: this.config.voiceGender || 'female',
        region: this.config.azureRegion,
      }, 'Azure Text-to-Speech service initialized successfully');
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize Azure TTS service');
      throw error;
    }
  }

  /**
   * Select appropriate voice based on language and gender
   */
  private selectVoice(language: string, gender: VoiceGender): string {
    // Check if we have predefined voices for this language
    const voices = AZURE_VOICES[language];

    if (voices) {
      return voices[gender];
    }

    // Fallback: try base language (e.g., fr-FR -> fr)
    const baseLanguage = language.split('-')[0] || 'en';
    const fallbackKey = Object.keys(AZURE_VOICES).find((key) =>
      key.startsWith(baseLanguage)
    );

    if (fallbackKey) {
      const fallbackVoices = AZURE_VOICES[fallbackKey];
      if (fallbackVoices) {
        logger.warn({
          requestedLanguage: language,
          fallbackLanguage: fallbackKey,
        }, 'Using fallback language for voice selection');
        return fallbackVoices[gender];
      }
    }

    // Ultimate fallback: English US female
    logger.warn({
      requestedLanguage: language,
      gender,
    }, 'No voice found for language, using en-US-JennyNeural');
    return 'en-US-JennyNeural';
  }

  async synthesize(text: string): Promise<TTSResult> {
    if (!this.synthesizer) {
      throw new Error('Azure TTS service not initialized');
    }

    if (!text || text.trim().length === 0) {
      return {
        audioContent: Buffer.from([]),
        duration: 0,
        timestamp: Date.now(),
      };
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.circuitBreaker.execute(() =>
        this.synthesizeText(text)
      );

      const latency = Date.now() - startTime;
      this.metrics.successfulRequests++;
      this.updateAverageLatency(latency);

      logAPICall('Azure Speech TTS', 'synthesize', latency, true, {
        textLength: text.length,
        audioSize: result.audioContent.length,
      });

      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.metrics.lastError = error as Error;

      const latency = Date.now() - startTime;
      logAPICall('Azure Speech TTS', 'synthesize', latency, false, {
        error: (error as Error).message,
      });

      logger.error({ err: error, textLength: text.length }, 'Azure TTS synthesis failed');
      throw error;
    }
  }

  private async synthesizeText(text: string): Promise<TTSResult> {
    return new Promise((resolve, reject) => {
      if (!this.synthesizer) {
        reject(new Error('Synthesizer not initialized'));
        return;
      }

      this.synthesizer.speakTextAsync(
        text,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            const audioData = Buffer.from(result.audioData);

            // Calculate approximate duration (MP3 at 32kbps)
            // Formula: (audioSize in bytes × 8) / bitrate
            const durationSeconds = (audioData.length * 8) / 32000;

            resolve({
              audioContent: audioData,
              duration: durationSeconds,
              timestamp: Date.now(),
            });
          } else if (result.reason === sdk.ResultReason.Canceled) {
            const errorDetails = result.errorDetails || 'Synthesis was canceled';
            reject(new Error(`Synthesis canceled: ${errorDetails}`));
          } else {
            reject(
              new Error(`Synthesis failed: ${sdk.ResultReason[result.reason]}`)
            );
          }
        },
        (error) => {
          reject(new Error(`Synthesis error: ${error}`));
        }
      );
    });
  }

  private updateAverageLatency(latency: number): void {
    const total = this.metrics.totalRequests;
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (total - 1) + latency) / total;
  }

  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  async close(): Promise<void> {
    if (this.synthesizer) {
      this.synthesizer.close();
      this.synthesizer = null;
    }
    logger.info('Azure Text-to-Speech service closed');
  }
}
