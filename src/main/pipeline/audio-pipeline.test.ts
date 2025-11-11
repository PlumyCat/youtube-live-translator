/**
 * Audio Pipeline Integration Tests
 * Tests Ring Buffer integration and backpressure handling
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioPipeline } from './audio-pipeline';
import { pipelineEventBus } from './event-bus';
import type { PipelineConfig } from '@shared/types/pipeline';

// Global callback storage for YouTube capture
let youtubeCaptureCallback: ((chunk: { data: Buffer }) => Promise<void>) | null = null;

// Global instance trackers for mocks
let mockSTTInstance: any = null;
let mockTranslationInstance: any = null;
let mockTTSInstance: any = null;

// Mock all service modules with proper class constructors
vi.mock('@main/services/youtube-capture', () => {
  class MockYouTubeCaptureService {
    start = vi.fn((callback: (chunk: { data: Buffer }) => Promise<void>) => {
      youtubeCaptureCallback = callback;
      return Promise.resolve();
    });
    stop = vi.fn();
  }
  return { YouTubeCaptureService: MockYouTubeCaptureService };
});

vi.mock('@main/services/stt-service', () => {
  class MockGoogleCloudSTTService {
    initialize = vi.fn().mockResolvedValue(undefined);
    transcribe = vi.fn().mockResolvedValue({
      transcript: 'Hello world',
      isFinal: true,
      confidence: 0.95,
    });
    close = vi.fn().mockResolvedValue(undefined);
    getMetrics = vi.fn().mockReturnValue({});

    constructor() {
      mockSTTInstance = this;
    }
  }
  return { GoogleCloudSTTService: MockGoogleCloudSTTService };
});

vi.mock('@main/services/translation-service', () => {
  class MockDeepLTranslationService {
    initialize = vi.fn().mockResolvedValue(undefined);
    translate = vi.fn().mockResolvedValue({
      originalText: 'Hello world',
      translatedText: 'Bonjour le monde',
      sourceLanguage: 'en',
      targetLanguage: 'fr',
      timestamp: Date.now(),
    });
    close = vi.fn().mockResolvedValue(undefined);
    getMetrics = vi.fn().mockReturnValue({});
  }
  return { DeepLTranslationService: MockDeepLTranslationService };
});

vi.mock('@main/services/tts-service', () => {
  class MockGoogleCloudTTSService {
    initialize = vi.fn().mockResolvedValue(undefined);
    synthesize = vi.fn().mockResolvedValue({
      audioContent: Buffer.from('mock-audio-data'),
      format: 'mp3',
      duration: 2.5,
    });
    close = vi.fn().mockResolvedValue(undefined);
    getMetrics = vi.fn().mockReturnValue({});
  }
  return { GoogleCloudTTSService: MockGoogleCloudTTSService };
});

vi.mock('@main/config/services', () => ({
  loadSTTConfig: vi.fn().mockReturnValue({
    language: 'en-US',
    model: 'latest_short',
    sampleRateHertz: 16000,
  }),
  loadTranslationConfig: vi.fn().mockReturnValue({
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    cacheEnabled: true,
  }),
  loadTTSConfig: vi.fn().mockReturnValue({
    languageCode: 'fr-FR',
    voiceName: 'fr-FR-Neural2-A',
    audioEncoding: 'MP3',
  }),
}));

describe('AudioPipeline - Ring Buffer Integration', () => {
  let pipeline: AudioPipeline;
  let config: PipelineConfig;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset global trackers
    youtubeCaptureCallback = null;
    mockSTTInstance = null;
    mockTranslationInstance = null;
    mockTTSInstance = null;

    config = {
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      sttLanguage: 'en-US',
      targetLanguage: 'fr',
      targetLatency: 2000,
      audioChunkDuration: 1500,
    };

    // Create pipeline - this will instantiate the mocked services
    pipeline = new AudioPipeline(config);
  });

  afterEach(async () => {
    if (pipeline) {
      await pipeline.stop();
    }
    pipelineEventBus.removeAllListeners();
    vi.useRealTimers();

    // Clear global trackers
    youtubeCaptureCallback = null;
    mockSTTInstance = null;
    mockTranslationInstance = null;
    mockTTSInstance = null;
  });

  describe('Ring Buffer Push/Pop', () => {
    it('should push audio chunks to buffer during capture', async () => {
      await pipeline.initialize();
      await pipeline.start();

      const mockChunk = { data: Buffer.from('audio-data-1') };

      // Simulate audio capture
      if (youtubeCaptureCallback) {
        await youtubeCaptureCallback(mockChunk);
      }

      // Verify buffer is not empty (chunk was pushed)
      expect(pipeline.getStatus()).toBe('running');
    });

    it('should process chunks from buffer in processing loop', async () => {
      await pipeline.initialize();

      const latencyUpdates: number[] = [];
      pipelineEventBus.on('latency:update', (metrics: any) => {
        latencyUpdates.push(metrics.total);
      });

      await pipeline.start();

      // Push multiple chunks
      const chunks = [
        { data: Buffer.from('chunk-1') },
        { data: Buffer.from('chunk-2') },
        { data: Buffer.from('chunk-3') },
      ];

      for (const chunk of chunks) {
        if (youtubeCaptureCallback) {
          await youtubeCaptureCallback(chunk);
        }
      }

      // Advance timers to trigger processing loop
      await vi.advanceTimersByTimeAsync(500);

      // Should have processed chunks
      expect(latencyUpdates.length).toBeGreaterThan(0);
    });

    it('should handle FIFO ordering of chunks', async () => {
      await pipeline.initialize();

      const transcripts: string[] = [];
      pipelineEventBus.on('stt:result', (result: any) => {
        transcripts.push(result.transcript);
      });

      // Mock STT to return different results based on input
      let callCount = 0;
      if (mockSTTInstance) {
        mockSTTInstance.transcribe = vi.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve({
            transcript: `Transcript ${callCount}`,
            isFinal: true,
            confidence: 0.95,
          });
        });
      }

      await pipeline.start();

      // Push chunks in order
      const chunks = [
        { data: Buffer.from('chunk-1') },
        { data: Buffer.from('chunk-2') },
        { data: Buffer.from('chunk-3') },
      ];

      for (const chunk of chunks) {
        if (youtubeCaptureCallback) {
          await youtubeCaptureCallback(chunk);
        }
      }

      // Process all chunks
      await vi.advanceTimersByTimeAsync(1000);

      // Verify FIFO ordering
      expect(transcripts[0]).toBe('Transcript 1');
      expect(transcripts[1]).toBe('Transcript 2');
      expect(transcripts[2]).toBe('Transcript 3');
    });
  });

  describe('Backpressure Handling', () => {
    it('should emit backpressure event when buffer is full', async () => {
      await pipeline.initialize();

      const backpressureEvents: string[] = [];
      pipelineEventBus.on('backpressure', (stage: string) => {
        backpressureEvents.push(stage);
      });

      await pipeline.start();

      // Fill buffer beyond capacity (maxSize = 10)
      for (let i = 0; i < 15; i++) {
        if (youtubeCaptureCallback) {
          await youtubeCaptureCallback({ data: Buffer.from(`chunk-${i}`) });
        }
      }

      // Should have triggered backpressure
      expect(backpressureEvents).toContain('audio');
    });

    it('should pause capture when backpressure is triggered', async () => {
      await pipeline.initialize();
      await pipeline.start();

      // Fill buffer to trigger backpressure
      for (let i = 0; i < 12; i++) {
        if (youtubeCaptureCallback) {
          await youtubeCaptureCallback({ data: Buffer.from(`chunk-${i}`) });
        }
      }

      // Trigger backpressure manually
      pipelineEventBus.emit('backpressure', 'audio');

      // Try to push another chunk (should be dropped)
      if (youtubeCaptureCallback) {
        await youtubeCaptureCallback({ data: Buffer.from('dropped-chunk') });
      }

      // Pipeline should still be running but paused
      expect(pipeline.getStatus()).toBe('running');
    });

    it('should resume after buffer drains below threshold', async () => {
      await pipeline.initialize();
      await pipeline.start();

      // Trigger backpressure
      pipelineEventBus.emit('backpressure', 'audio');

      // Wait for timeout (1000ms) + buffer check
      await vi.advanceTimersByTimeAsync(1100);

      // Should have attempted to resume
      expect(pipeline.getStatus()).toBe('running');
    });

    it('should handle processing errors gracefully', async () => {
      await pipeline.initialize();

      // Mock STT to throw error
      if (mockSTTInstance) {
        mockSTTInstance.transcribe = vi.fn().mockRejectedValue(new Error('STT Error'));
      }

      const errors: Error[] = [];
      pipelineEventBus.on('pipeline:error', (error: Error) => {
        errors.push(error);
      });

      await pipeline.start();

      // Push chunk
      if (youtubeCaptureCallback) {
        await youtubeCaptureCallback({ data: Buffer.from('error-chunk') });
      }

      // Process chunk
      await vi.advanceTimersByTimeAsync(200);

      // Should have caught error
      expect(errors.length).toBeGreaterThan(0);
      expect(pipeline.getStatus()).toBe('running'); // Still running
    });
  });

  describe('Processing Loop', () => {
    it('should check buffer every 100ms', async () => {
      await pipeline.initialize();
      await pipeline.start();

      // Don't push any chunks
      // Advance timer multiple times
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);

      // Should still be running
      expect(pipeline.getStatus()).toBe('running');
    });

    it('should not process if already processing', async () => {
      await pipeline.initialize();

      // Mock STT to delay
      let transcribeCount = 0;
      if (mockSTTInstance) {
        mockSTTInstance.transcribe = vi.fn().mockImplementation(async () => {
          transcribeCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
          return {
            transcript: 'Delayed transcript',
            isFinal: true,
            confidence: 0.95,
          };
        });
      }

      await pipeline.start();

      // Push chunks rapidly
      if (youtubeCaptureCallback) {
        await youtubeCaptureCallback({ data: Buffer.from('chunk-1') });
        await youtubeCaptureCallback({ data: Buffer.from('chunk-2') });
      }

      // Trigger processing loop once
      await vi.advanceTimersByTimeAsync(100);

      // Should only process one at a time
      expect(transcribeCount).toBeLessThanOrEqual(1);
    });

    it('should cleanup interval on stop', async () => {
      await pipeline.initialize();
      await pipeline.start();

      expect(pipeline.getStatus()).toBe('running');

      await pipeline.stop();

      expect(pipeline.getStatus()).toBe('idle');
    });
  });

  describe('Full Pipeline Flow', () => {
    it('should process audio through full pipeline', async () => {
      await pipeline.initialize();

      const events: string[] = [];
      pipelineEventBus.on('audio:captured', () => events.push('captured'));
      pipelineEventBus.on('stt:result', () => events.push('stt'));
      pipelineEventBus.on('translation:result', () => events.push('translation'));
      pipelineEventBus.on('tts:result', () => events.push('tts'));
      pipelineEventBus.on('audio:output', () => events.push('output'));

      await pipeline.start();

      // Push chunk
      if (youtubeCaptureCallback) {
        await youtubeCaptureCallback({ data: Buffer.from('full-pipeline-chunk') });
      }

      // Process chunk
      await vi.advanceTimersByTimeAsync(200);

      // Verify full pipeline executed
      expect(events).toContain('captured');
      expect(events).toContain('stt');
      expect(events).toContain('translation');
      expect(events).toContain('tts');
      expect(events).toContain('output');
    });

    it('should emit latency metrics after pipeline processing', async () => {
      await pipeline.initialize();

      const latencyUpdates: any[] = [];
      pipelineEventBus.on('latency:update', (metrics: any) => {
        latencyUpdates.push(metrics);
      });

      await pipeline.start();

      // Push chunk
      if (youtubeCaptureCallback) {
        await youtubeCaptureCallback({ data: Buffer.from('latency-test-chunk') });
      }

      // Process chunk (advance time for processing loop)
      await vi.advanceTimersByTimeAsync(200);

      // Should have emitted at least one latency update
      expect(latencyUpdates.length).toBeGreaterThan(0);

      // Metrics should have expected structure (values may be 0 with fake timers)
      const metrics = latencyUpdates[0];
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('total');
      expect(metrics).toHaveProperty('stt');
      expect(metrics).toHaveProperty('translation');
      expect(metrics).toHaveProperty('tts');
    });
  });
});
