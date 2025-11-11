/**
 * Test script for Azure services integration
 * Tests STT, Translation, and TTS with Azure Cognitive Services
 */
import 'dotenv/config';
import { AzureSpeechSTTService } from '../src/main/services/azure-stt-service';
import { AzureTranslatorService } from '../src/main/services/azure-translator-service';
import { AzureSpeechTTSService } from '../src/main/services/azure-tts-service';
import type { STTConfig, TranslationConfig, TTSConfig } from '../src/shared/types/services';

async function testAzureServices() {
  console.log('🧪 Testing Azure Services Integration\n');

  // Check environment variables
  const azureSpeechKey = process.env.AZURE_SPEECH_KEY;
  const azureSpeechRegion = process.env.AZURE_SPEECH_REGION || 'westeurope';
  const azureTranslatorKey = process.env.AZURE_TRANSLATOR_KEY;
  const azureTranslatorRegion = process.env.AZURE_TRANSLATOR_REGION || 'westeurope';
  const azureTranslatorEndpoint =
    process.env.AZURE_TRANSLATOR_ENDPOINT ||
    'https://api.cognitive.microsofttranslator.com/';

  if (!azureSpeechKey) {
    console.error('❌ AZURE_SPEECH_KEY not found in environment');
    process.exit(1);
  }

  if (!azureTranslatorKey) {
    console.error('❌ AZURE_TRANSLATOR_KEY not found in environment');
    process.exit(1);
  }

  console.log('✅ Azure credentials found\n');

  // Test Translation Service
  try {
    console.log('📝 Testing Azure Translator Service...');
    const translationConfig: TranslationConfig = {
      provider: 'azure',
      sourceLanguage: 'en-US',
      targetLanguage: 'fr-FR',
      cacheEnabled: true,
      azureKey: azureTranslatorKey,
      azureRegion: azureTranslatorRegion,
      azureEndpoint: azureTranslatorEndpoint,
    };

    const translationService = new AzureTranslatorService(translationConfig);
    await translationService.initialize();

    const testText = 'Hello, how are you today?';
    console.log(`   Input: "${testText}"`);

    const startTime = Date.now();
    const result = await translationService.translate(testText);
    const latency = Date.now() - startTime;

    console.log(`   Output: "${result.translatedText}"`);
    console.log(`   Latency: ${latency}ms`);
    console.log(`   ✅ Translation successful\n`);

    const metrics = translationService.getMetrics();
    console.log(`   Metrics: ${metrics.successfulRequests}/${metrics.totalRequests} successful`);

    await translationService.close();
  } catch (error) {
    console.error('❌ Translation test failed:', error);
    process.exit(1);
  }

  // Test TTS Service
  try {
    console.log('\n🔊 Testing Azure Speech TTS Service...');
    const ttsConfig: TTSConfig = {
      provider: 'azure',
      language: 'fr-FR',
      voiceName: 'fr-FR-DeniseNeural',
      voiceGender: 'female',
      audioEncoding: 'MP3',
      sampleRate: 16000,
      azureKey: azureSpeechKey,
      azureRegion: azureSpeechRegion,
    };

    const ttsService = new AzureSpeechTTSService(ttsConfig);
    await ttsService.initialize();

    const testText = 'Bonjour, comment allez-vous aujourd\'hui ?';
    console.log(`   Input: "${testText}"`);

    const startTime = Date.now();
    const result = await ttsService.synthesize(testText);
    const latency = Date.now() - startTime;

    console.log(`   Audio size: ${result.audioContent.length} bytes`);
    console.log(`   Duration: ${result.duration.toFixed(2)}s`);
    console.log(`   Latency: ${latency}ms`);
    console.log(`   ✅ TTS synthesis successful\n`);

    const metrics = ttsService.getMetrics();
    console.log(`   Metrics: ${metrics.successfulRequests}/${metrics.totalRequests} successful`);

    await ttsService.close();
  } catch (error) {
    console.error('❌ TTS test failed:', error);
    process.exit(1);
  }

  // Test STT Service (note: requires actual audio data)
  console.log('\n🎤 Azure Speech STT Service');
  console.log('   ⚠️  STT testing requires audio data');
  console.log('   To test STT, use test-stt-with-speech.ts with AZURE provider\n');

  console.log('✅ All Azure services tests passed!');
  console.log('\n📊 Summary:');
  console.log('   • Azure Translator: ✅ Working');
  console.log('   • Azure TTS: ✅ Working');
  console.log('   • Azure STT: ⚠️  Requires audio data for testing');
  console.log('\n💡 To use Azure services in the app:');
  console.log('   Set in .env: STT_PROVIDER=azure, TRANSLATION_PROVIDER=azure, TTS_PROVIDER=azure');
}

// Run tests
testAzureServices()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
