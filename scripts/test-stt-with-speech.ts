/**
 * Test STT avec un vrai fichier audio de parole
 *
 * Utilise la synthèse vocale pour créer un fichier audio avec du texte parlé,
 * puis teste la reconnaissance vocale dessus
 */
import dotenv from 'dotenv';
import { createComponentLogger } from '../src/main/utils/logger';
import { GoogleCloudSTTService } from '../src/main/services/stt-service';
import { GoogleCloudTTSService } from '../src/main/services/tts-service';
import { loadSTTConfig, loadTTSConfig } from '../src/main/config/services';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

dotenv.config();

const logger = createComponentLogger('TestSTT');

/**
 * Convert MP3 to PCM using ffmpeg
 */
async function convertMP3ToPCM(mp3Path: string, pcmPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', mp3Path,           // Input MP3
      '-f', 's16le',           // Output format: signed 16-bit little-endian
      '-acodec', 'pcm_s16le',  // Audio codec
      '-ar', '16000',          // Sample rate 16kHz
      '-ac', '1',              // Mono
      '-y',                    // Overwrite output
      pcmPath                  // Output PCM file
    ]);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Main test function
 */
async function testSTTWithSpeech() {
  logger.info('Starting STT test with real speech');

  try {
    // Step 1: Initialize TTS to generate test audio
    logger.info('Initializing TTS service to generate test audio...');
    const ttsConfig = loadTTSConfig();
    const ttsService = new GoogleCloudTTSService(ttsConfig);
    await ttsService.initialize();
    logger.info('✓ TTS service initialized');

    // Step 2: Generate speech audio
    const testPhrase = 'Hello, this is a test of the speech recognition system.';
    logger.info({ phrase: testPhrase }, 'Generating speech audio...');

    const ttsResult = await ttsService.synthesize(testPhrase);

    const audioDir = path.join(process.cwd(), 'test-audio');
    await fs.mkdir(audioDir, { recursive: true });

    const mp3Path = path.join(audioDir, 'test-speech.mp3');
    await fs.writeFile(mp3Path, ttsResult.audioContent);
    logger.info({ path: mp3Path, size: ttsResult.audioContent.length }, '✓ Speech audio generated (MP3)');

    // Step 3: Convert MP3 to PCM for STT
    logger.info('Converting MP3 to PCM...');
    const pcmPath = path.join(audioDir, 'test-speech.pcm');
    await convertMP3ToPCM(mp3Path, pcmPath);

    const pcmBuffer = await fs.readFile(pcmPath);
    logger.info({ path: pcmPath, size: pcmBuffer.length }, '✓ Audio converted to PCM');

    // Step 4: Initialize STT
    logger.info('Initializing STT service...');
    const sttConfig = loadSTTConfig();
    const sttService = new GoogleCloudSTTService(sttConfig);
    await sttService.initialize();
    logger.info('✓ STT service initialized');

    // Step 5: Transcribe
    logger.info('Transcribing audio...');
    const startTime = Date.now();

    const sttResult = await sttService.transcribe(pcmBuffer);
    const latency = Date.now() - startTime;

    logger.info(
      {
        original: testPhrase,
        transcribed: sttResult.transcript,
        confidence: sttResult.confidence,
        isFinal: sttResult.isFinal,
        latency,
        match: sttResult.transcript.toLowerCase().includes('test'),
      },
      '✓ Transcription completed'
    );

    // Step 6: Verify accuracy
    const transcriptLower = sttResult.transcript.toLowerCase();
    const phraseLower = testPhrase.toLowerCase();

    // Simple accuracy check
    const wordsInOriginal = phraseLower.split(' ');
    const wordsFound = wordsInOriginal.filter(word =>
      transcriptLower.includes(word)
    ).length;

    const accuracy = (wordsFound / wordsInOriginal.length) * 100;

    logger.info(
      {
        accuracy: `${accuracy.toFixed(1)}%`,
        wordsMatched: `${wordsFound}/${wordsInOriginal.length}`,
        status: accuracy > 50 ? '✅ PASS' : '❌ FAIL',
      },
      'Accuracy check'
    );

    // Cleanup
    await ttsService.close();
    await sttService.close();

    return {
      success: true,
      original: testPhrase,
      transcribed: sttResult.transcript,
      confidence: sttResult.confidence,
      latency,
      accuracy,
    };

  } catch (error) {
    logger.error({ err: error }, 'STT test failed');
    throw error;
  }
}

// Run the test
testSTTWithSpeech()
  .then(result => {
    console.log('\n✅ STT test completed');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ STT test failed:', error);
    process.exit(1);
  });
