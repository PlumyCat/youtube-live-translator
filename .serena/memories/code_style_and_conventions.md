# Code Style and Conventions - YouTube Live Translator

## Naming Conventions

### Files
- Use `kebab-case.ts` for files (e.g., `audio-pipeline.ts`, `stt-service.ts`)

### Classes
- Use `PascalCase` (e.g., `AudioPipeline`, `STTService`, `TranslationCache`)

### Functions and Methods
- Use `camelCase` (e.g., `startTranslation()`, `processAudioChunk()`)

### Constants
- Use `UPPER_SNAKE_CASE` (e.g., `MAX_LATENCY`, `DEFAULT_CHUNK_SIZE`)

### Types and Interfaces
- Use `PascalCase` (e.g., `TranslationRequest`, `AudioConfig`)

## Import Structure
Organize imports in this exact order:

```typescript
// 1. Node.js built-ins
import { pipeline } from 'stream';
import { EventEmitter } from 'events';

// 2. External dependencies
import { z } from 'zod';
import axios from 'axios';

// 3. Internal modules (using path aliases)
import { AudioPipeline } from '@main/pipeline/audio-pipeline';
import { STTService } from '@main/services/stt.service';

// 4. Relative imports
import { RingBuffer } from './ring-buffer';
import { LatencyMonitor } from './latency-monitor';

// 5. Type imports (always separate)
import type { TranslationRequest } from '@shared/types';
import type { AudioConfig } from './types';
```

## Path Aliases
Configured path aliases for cleaner imports:
- `@main` → `src/main`
- `@renderer` → `src/renderer`
- `@shared` → `src/shared`
- `@preload` → `src/preload`

## TypeScript Configuration

### Strictness (tsconfig.json)
```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

### Type Safety Patterns

**Use Zod for validation:**
```typescript
const ConfigSchema = z.object({
  apiKey: z.string().min(1),
  timeout: z.number().positive(),
});
export type AppConfig = z.infer<typeof ConfigSchema>;
```

**Branded types for safety:**
```typescript
export type YouTubeURL = string & { __brand: 'YouTubeURL' };
```

**Avoid `any`, use `unknown` + type guards:**
```typescript
function handleData(data: unknown): void {
  if (isValidData(data)) {
    processData(data); // Type narrowed
  }
}
```

## Design Patterns

### 1. Event-Driven Architecture
Use EventEmitter for pipeline communication:
```typescript
import { EventEmitter } from 'events';

class AppEventBus extends EventEmitter {
  emitTranscript(text: string) {
    this.emit('transcript-ready', text);
  }
}
```

### 2. Service Layer Pattern
Services with interfaces for easy mocking:
```typescript
export interface ITranslationService {
  translate(text: string): Promise<string>;
}

export class DeepLTranslationService implements ITranslationService {
  async translate(text: string): Promise<string> {
    // Implementation
  }
}
```

### 3. Pipeline Pattern
Use Node.js Streams for audio processing:
```typescript
import { Transform, pipeline } from 'stream';

pipeline(
  audioSource,
  sttTransform,
  translationTransform,
  ttsTransform,
  audioOutput,
  (error) => {
    if (error) console.error('Pipeline error:', error);
  }
);
```

## Critical Code Patterns

### Error Handling
**Always use Circuit Breaker + Retry Logic:**
```typescript
const circuitBreaker = new CircuitBreaker(5, 60000);

try {
  const result = await circuitBreaker.execute(() =>
    retryWithBackoff(() => apiService.call(), 3)
  );
} catch (error) {
  if (error instanceof APIError) {
    logger.error('API Error:', { service, error });
  }
}
```

**Never:**
- Empty try-catch blocks without logging
- Infinite retries without Circuit Breaker
- Ignoring network/API errors

### Electron Security
**Mandatory configuration:**
```typescript
webPreferences: {
  nodeIntegration: false,      // ✅ REQUIRED
  contextIsolation: true,      // ✅ REQUIRED
  sandbox: true,               // ✅ REQUIRED
  preload: path.join(__dirname, 'preload.js'),
}
```

**Preload: Always validate IPC calls:**
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  startTranslation: (url: string) => {
    if (!isYouTubeURL(url)) {
      throw new Error('Invalid YouTube URL');
    }
    return ipcRenderer.invoke('translation:start', url);
  },
});
```

### Memory Management
**Cleanup is mandatory:**
```typescript
// React hooks
useEffect(() => {
  const unsubscribe = window.electronAPI.onLatencyUpdate(handleLatency);
  return () => unsubscribe(); // ✅ Cleanup
}, []);

// Ring Buffer with explicit limits
const buffer = new RingBuffer<Buffer>(10); // Max 10 items
if (buffer.isFull()) {
  eventBus.emit('backpressure');
}
```

## Testing Standards

### Coverage Target: 80%+
- Unit tests: 70% of test suite
- Integration tests: 20%
- E2E tests: 10%

### Critical Tests
- Latency < 2000ms (with mocked services)
- Circuit Breaker triggers after 5 failures
- Cache hit ratio > 20%
- Backpressure on full Ring Buffer

## Logging
Use structured logging with Pino:
```typescript
logger.info({
  stage: 'stt',
  duration: 450,
  latency: 1200,
  timestamp: Date.now(),
}, 'STT processing completed');
```

## Performance Monitoring
**Always track latency:**
```typescript
const startTime = Date.now();
const result = await service.call();
const duration = Date.now() - startTime;
logger.info({ stage, duration }, `Stage completed`);
```

## ESLint and Prettier
- **ESLint**: Enforces code quality and TypeScript rules
- **Prettier**: Auto-formatting on save
- Pre-commit hooks ensure consistency