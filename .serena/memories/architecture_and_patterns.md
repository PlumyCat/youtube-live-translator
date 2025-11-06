# Architecture and Design Patterns - YouTube Live Translator

## Overall Architecture

### High-Level Flow
```
YouTube Video
    ↓ (yt-dlp + ffmpeg)
Audio Stream
    ↓ (Ring Buffer)
STT Service (Google Cloud, ~400ms)
    ↓
Translation Service (DeepL, ~300ms)
    ↓
TTS Service (Google Neural2, ~600ms)
    ↓ (Web Audio API)
Audio Output (translated)
```

### Three-Layer Architecture

1. **UI Layer** (Renderer Process)
   - React 18 components
   - Zustand state management
   - IPC communication to main process

2. **Main Process Layer** (Electron Main)
   - Services: STT, Translation, TTS, Audio Capture/Output
   - Pipeline orchestration
   - Event-driven communication

3. **Infrastructure Layer**
   - Configuration management
   - Logging (Pino)
   - Caching (LRU)
   - Error handling (Circuit Breaker)
   - Metrics collection

## Core Design Patterns

### 1. Event-Driven Architecture
**Used for**: Pipeline communication, loose coupling between services

```typescript
// Central event bus
class AppEventBus extends EventEmitter {
  emitAudioChunk(chunk: Buffer) {
    this.emit('audio:chunk', chunk);
  }
  
  emitTranscript(text: string) {
    this.emit('stt:transcript', text);
  }
}

export const eventBus = new AppEventBus();
```

**Benefits:**
- Decoupled services
- Easy to add new event listeners
- Asynchronous processing

### 2. Pipeline Pattern
**Used for**: Sequential audio processing with transforms

```typescript
import { Transform, pipeline } from 'stream';

class AudioProcessingPipeline {
  start(source: NodeJS.ReadableStream) {
    pipeline(
      source,
      sttTransform,
      translationTransform,
      ttsTransform,
      audioOutput,
      (error) => {
        if (error) handlePipelineError(error);
      }
    );
  }
}
```

**Benefits:**
- Streaming data processing
- Memory efficient
- Backpressure handling

### 3. Service Layer Pattern
**Used for**: Encapsulate business logic, easy mocking

```typescript
export interface ITranslationService {
  translate(text: string, from: string, to: string): Promise<string>;
}

export class DeepLTranslationService implements ITranslationService {
  constructor(private apiKey: string) {}
  
  async translate(text: string, from: string, to: string): Promise<string> {
    // Implementation
  }
}

// Factory for creating services
export class ServiceFactory {
  static createTranslation(provider: string): ITranslationService {
    switch (provider) {
      case 'deepl': return new DeepLTranslationService(API_KEY);
      case 'google': return new GoogleTranslationService(API_KEY);
      default: throw new Error('Unknown provider');
    }
  }
}
```

**Benefits:**
- Testability (easy mocking)
- Flexibility (swap implementations)
- Clear separation of concerns

### 4. Repository Pattern
**Used for**: Cache abstraction, persistence layer

```typescript
export interface ICacheRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

class TranslationCacheManager {
  constructor(private repository: ICacheRepository) {}
  
  async getTranslation(text: string): Promise<string | null> {
    const key = this.generateKey(text);
    return this.repository.get(key);
  }
}
```

**Benefits:**
- Abstract persistence details
- Easy to swap storage (memory, disk, Redis)
- Testable with mocks

### 5. Circuit Breaker Pattern
**Used for**: Prevent cascading failures in API calls

```typescript
enum CircuitState {
  CLOSED,     // Normal operation
  OPEN,       // Failing, reject requests
  HALF_OPEN,  // Testing recovery
}

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      throw new Error('Circuit breaker is OPEN');
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

**Benefits:**
- Prevent wasted calls to failing services
- Auto-recovery when service comes back
- System stability

### 6. Retry with Exponential Backoff
**Used for**: Transient error recovery

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let delay = 1000;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}
```

**Benefits:**
- Handle transient failures
- Avoid overwhelming failing services
- Improved reliability

## Critical Optimization Strategies

### 1. Streaming vs Batching (Hybrid Approach)
- **STT**: Use streaming for continuous transcription
- **Translation**: Batch 3-5 sentences for cost efficiency
- **TTS**: Parallel synthesis of batched translations

### 2. Ring Buffer with Backpressure
```typescript
class RingBuffer<T> {
  private buffer: Array<T>;
  private capacity: number;
  
  push(item: T): boolean {
    if (this.isFull()) {
      // Emit backpressure event
      eventBus.emit('backpressure');
      return false;
    }
    this.buffer.push(item);
    return true;
  }
}
```

### 3. LRU Cache for Translations
- Cache hit ratio target: > 20%
- TTL: 24 hours
- Max size: 1000 entries
- Persistent to disk for session continuity

### 4. Adaptive Chunk Sizing
```typescript
class AdaptiveAudioChunker {
  private currentChunkSize = 1500; // ms
  
  adjustChunkSize(currentLatency: number) {
    if (currentLatency > TARGET_LATENCY * 1.2) {
      // Reduce chunk size to improve latency
      this.currentChunkSize = Math.max(MIN_SIZE, this.currentChunkSize - 200);
    } else if (currentLatency < TARGET_LATENCY * 0.7) {
      // Increase for better efficiency
      this.currentChunkSize = Math.min(MAX_SIZE, this.currentChunkSize + 200);
    }
  }
}
```

### 5. Worker Pool for Parallel Processing
- Use Worker Threads for CPU-intensive tasks
- Pool size: 4 workers (typical)
- Used for parallel TTS synthesis

## Performance Monitoring

### Latency Monitor
Track latency at each stage:
```typescript
class LatencyMonitor {
  recordStage(stage: string, duration: number) {
    logger.info({ metric: 'latency', stage, duration });
    metricsCollector.recordMetric(`latency.${stage}`, duration);
  }
}
```

### Budget Tracker
Monitor API costs in real-time:
```typescript
class BudgetTracker {
  recordUsage(service: string, units: number, costPerUnit: number) {
    const cost = units * costPerUnit;
    
    if (this.getMonthlySpend() > this.monthlyBudget * 0.8) {
      eventBus.emit('budget:warning');
    }
  }
}
```

### Network Quality Monitor
Adjust strategy based on network conditions:
```typescript
enum NetworkQuality {
  EXCELLENT,  // < 50ms latency
  GOOD,       // 50-150ms
  FAIR,       // 150-300ms
  POOR,       // > 300ms
  OFFLINE,
}
```

## Electron-Specific Patterns

### IPC Communication
**Main → Renderer:**
```typescript
mainWindow.webContents.send('latency-update', latency);
```

**Renderer → Main:**
```typescript
window.electronAPI.startTranslation(url);
```

**Preload Bridge (secure):**
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  startTranslation: (url: string) => {
    if (!isValidURL(url)) throw new Error('Invalid URL');
    return ipcRenderer.invoke('translation:start', url);
  },
});
```

## Key Architectural Decisions

1. **Electron over Tauri**: Mature audio ecosystem, Web Audio API, easier development
2. **Google Cloud STT**: Best latency (200-400ms) with streaming support
3. **DeepL Translation**: Superior quality for EN↔FR (98% accuracy)
4. **Google TTS Neural2**: Natural voices, low latency
5. **Hybrid streaming/batching**: Balance latency vs efficiency
6. **Event-driven**: Decoupled services, easy scaling
7. **TypeScript strict mode**: Type safety for complex async pipelines

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| Total Latency | < 2000ms | Streaming + adaptive chunking |
| P50 Latency | < 1500ms | Optimized pipeline |
| P95 Latency | < 1900ms | Error handling + retry |
| Cache Hit Ratio | > 20% | LRU cache with persistence |
| Monthly Cost | < $70 | Budget tracking + alerts |
| Test Coverage | > 80% | Unit + integration + E2E |