# Commande : review-code

Code review avec focus sur performance, sécurité et maintenabilité.

## Checklist Code Review

### 1. Performance

#### Pipeline Audio
```typescript
// ✅ Bon : Streaming avec backpressure
const buffer = new RingBuffer(10);
if (!buffer.push(chunk)) {
  eventBus.emit('backpressure');
}

// ❌ Mauvais : Buffer illimité (memory leak)
const buffer: Buffer[] = [];
buffer.push(chunk); // Pas de limite
```

#### API Calls
```typescript
// ✅ Bon : Cache + Rate limiting
const cached = cache.get(key);
if (cached) return cached;

await rateLimiter.acquire();
const result = await apiCall();
cache.set(key, result);

// ❌ Mauvais : Appels répétés sans cache
const result = await apiCall(); // Toujours appeler API
```

#### React Rendering
```typescript
// ✅ Bon : Selectors optimisés
const latency = useTranslatorStore(state => state.currentLatency);

// ❌ Mauvais : Re-render à chaque changement
const state = useTranslatorStore(); // Tout le state
const latency = state.currentLatency;
```

### 2. Sécurité

#### Secrets Management
```typescript
// ✅ Bon : Secrets dans .env
const apiKey = process.env.DEEPL_API_KEY;

// ❌ DANGER : Secrets hardcodés
const apiKey = 'sk-1234567890abcdef'; // ❌ ❌ ❌
```

#### IPC Security
```typescript
// ✅ Bon : Validation inputs
ipcMain.handle('translation:start', async (event, url: string) => {
  if (!isYouTubeURL(url)) {
    throw new Error('Invalid YouTube URL');
  }
  // Process...
});

// ❌ Mauvais : Pas de validation
ipcMain.handle('translation:start', async (event, url) => {
  // Direct use sans validation
  await pipeline.start(url);
});
```

#### Electron Security
```typescript
// ✅ Bon : Sécurité activée
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  preload: path.join(__dirname, 'preload.js'),
}

// ❌ DANGER : Sécurité désactivée
webPreferences: {
  nodeIntegration: true,     // ❌
  contextIsolation: false,   // ❌
  sandbox: false,            // ❌
}
```

### 3. Error Handling

#### Try-Catch Systématique
```typescript
// ✅ Bon : Error handling complet
async function translate(text: string): Promise<string> {
  try {
    const result = await translationService.translate(text, 'en', 'fr');
    return result;
  } catch (error) {
    if (error instanceof APIError) {
      logger.error('API Error:', error);
      // Retry ou fallback
      return fallbackTranslation(text);
    }
    throw error;
  }
}

// ❌ Mauvais : Pas d'error handling
async function translate(text: string): Promise<string> {
  const result = await translationService.translate(text, 'en', 'fr');
  return result; // Crash si erreur
}
```

#### Circuit Breaker
```typescript
// ✅ Bon : Protection contre cascading failures
const circuitBreaker = new CircuitBreaker(5, 60000);

async function callAPI(): Promise<T> {
  return circuitBreaker.execute(() => apiService.call());
}

// ❌ Mauvais : Retry infini
async function callAPI(): Promise<T> {
  while (true) {
    try {
      return await apiService.call();
    } catch {
      // Retry forever → cascade failures
    }
  }
}
```

### 4. Types TypeScript

#### Type Safety
```typescript
// ✅ Bon : Types stricts
interface TranslationRequest {
  url: YouTubeURL; // Branded type
  source: 'en';
  target: 'fr';
}

function startTranslation(req: TranslationRequest): void {
  // Type-safe
}

// ❌ Mauvais : Types lâches
function startTranslation(url: any, source: any, target: any): void {
  // Pas de type checking
}
```

#### Éviter `any`
```typescript
// ✅ Bon : Type précis ou unknown
function handleData(data: unknown): void {
  if (isValidData(data)) {
    processData(data); // Type narrowed
  }
}

// ❌ Mauvais : any partout
function handleData(data: any): void {
  processData(data); // Pas de checking
}
```

### 5. Async/Await Best Practices

#### Error Propagation
```typescript
// ✅ Bon : Async/await avec try-catch
async function pipeline(): Promise<void> {
  try {
    const audio = await captureAudio();
    const transcript = await transcribe(audio);
    const translation = await translate(transcript);
    await synthesize(translation);
  } catch (error) {
    handleError(error);
  }
}

// ❌ Mauvais : Promise hell
function pipeline(): Promise<void> {
  return captureAudio()
    .then(audio => transcribe(audio))
    .then(transcript => translate(transcript))
    .then(translation => synthesize(translation))
    .catch(error => {
      // Error handling complexe
    });
}
```

#### Promise.all vs Sequential
```typescript
// ✅ Bon : Parallèle quand possible
const [stt, translation, tts] = await Promise.all([
  sttService.testConnection(),
  translationService.testConnection(),
  ttsService.testConnection(),
]);

// ❌ Mauvais : Séquentiel inutile
const stt = await sttService.testConnection();
const translation = await translationService.testConnection(); // Attendre
const tts = await ttsService.testConnection(); // Attendre
```

### 6. Memory Management

#### Cleanup Listeners
```typescript
// ✅ Bon : Cleanup dans useEffect
useEffect(() => {
  const unsubscribe = window.electronAPI.onLatencyUpdate(handleLatency);

  return () => {
    unsubscribe(); // Cleanup
  };
}, []);

// ❌ Mauvais : Pas de cleanup (memory leak)
useEffect(() => {
  window.electronAPI.onLatencyUpdate(handleLatency);
  // Pas de cleanup
}, []);
```

#### Buffer Limits
```typescript
// ✅ Bon : Limite explicite
const buffer = new RingBuffer<Buffer>(10); // Max 10 items

if (buffer.isFull()) {
  // Backpressure
}

// ❌ Mauvais : Croissance illimitée
const buffer: Buffer[] = [];
buffer.push(chunk); // Peut croître indéfiniment
```

### 7. Testing

#### Coverage
```typescript
// ✅ Bon : Tests complets
describe('TranslationService', () => {
  it('should translate correctly', async () => {
    const result = await service.translate('Hello', 'en', 'fr');
    expect(result).toBe('Bonjour');
  });

  it('should handle API errors', async () => {
    mockAPI.mockRejectedValue(new Error('API Down'));
    await expect(service.translate('Hello', 'en', 'fr')).rejects.toThrow();
  });

  it('should use cache', async () => {
    await service.translate('Hello', 'en', 'fr');
    await service.translate('Hello', 'en', 'fr');
    expect(mockAPI).toHaveBeenCalledTimes(1); // Cache hit
  });
});

// ❌ Mauvais : Tests insuffisants
describe('TranslationService', () => {
  it('should work', async () => {
    const result = await service.translate('Hello', 'en', 'fr');
    expect(result).toBeDefined();
  });
});
```

### 8. Logging

#### Structured Logging
```typescript
// ✅ Bon : Logs structurés avec contexte
logger.info({
  stage: 'translation',
  duration: 300,
  charCount: 42,
  cached: false,
}, 'Translation completed');

// ❌ Mauvais : Logs non-structurés
console.log('Translation done in 300ms'); // Pas de contexte
```

### 9. Configuration

#### Environment Variables
```typescript
// ✅ Bon : Validation avec Zod
const ConfigSchema = z.object({
  services: z.object({
    stt: z.object({
      provider: z.enum(['google', 'azure']),
      apiKey: z.string().min(1),
    }),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

const config = ConfigSchema.parse(rawConfig); // Valide

// ❌ Mauvais : Pas de validation
const config = {
  services: {
    stt: {
      provider: process.env.STT_PROVIDER, // Peut être undefined
      apiKey: process.env.API_KEY,
    },
  },
};
```

### 10. Code Quality

#### DRY (Don't Repeat Yourself)
```typescript
// ✅ Bon : Factoriser code répété
async function callAPIWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3
): Promise<T> {
  // Retry logic réutilisable
}

const sttResult = await callAPIWithRetry(() => sttService.transcribe(audio));
const translation = await callAPIWithRetry(() => translationService.translate(text));

// ❌ Mauvais : Dupliquer retry logic
async function transcribe(audio: Buffer): Promise<string> {
  for (let i = 0; i < 3; i++) {
    try {
      return await sttService.transcribe(audio);
    } catch { /* retry */ }
  }
}

async function translate(text: string): Promise<string> {
  for (let i = 0; i < 3; i++) {
    try {
      return await translationService.translate(text);
    } catch { /* retry */ }
  }
}
```

#### SOLID Principles
```typescript
// ✅ Bon : Dependency Injection
class AudioPipeline {
  constructor(
    private sttService: ISTTService,
    private translationService: ITranslationService,
    private ttsService: ITTSService
  ) {}
}

// Facile à tester avec mocks
const pipeline = new AudioPipeline(mockSTT, mockTranslation, mockTTS);

// ❌ Mauvais : Hard dependencies
class AudioPipeline {
  private sttService = new GoogleSTTService(); // Hard-coded
  private translationService = new DeepLTranslationService();
  private ttsService = new GoogleTTSService();
}
```

## Workflow Review

1. **Lancer linting**
   ```bash
   npm run lint
   ```

2. **Vérifier tests**
   ```bash
   npm test
   npm run test:coverage
   ```

3. **Review manuel** : Parcourir code avec cette checklist

4. **Performance profiling** si nécessaire
   ```bash
   # DevTools > Performance
   # Record pendant utilisation
   # Identifier bottlenecks
   ```

5. **Security audit**
   ```bash
   npm audit
   npm audit fix
   ```

Code revu et approuvé pour merge !
