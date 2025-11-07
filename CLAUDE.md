# CLAUDE.md - YouTube Live Translator

Guide concis pour Claude Code lors du développement sur ce projet.

## Vue d'ensemble

**Application Electron** de traduction en direct de vidéos YouTube avec pipeline audio temps-réel.

- **Stack**: Electron 32 + React 18 + TypeScript 5.6 + Vite + Zustand
- **Services**: Google Cloud (STT/TTS) + DeepL (Translation)
- **Objectif latence**: < 2000ms (optimal: < 1500ms)
- **Architecture**: Main Process (Node.js) + Renderer (React) + Preload (IPC Bridge)

## Commandes principales

### Développement quotidien
```bash
npm install          # Installe dépendances + postinstall automatique (fixe Rollup Windows)
npm run dev          # Lance l'app en mode dev
npm test             # Tests unitaires (Vitest)
npm run test:e2e     # Tests E2E (Playwright)
npm run lint         # ESLint + TypeScript check
```

**Note Windows** : Le script `postinstall` (scripts/postinstall.js) s'exécute automatiquement après `npm install` pour corriger le bug npm des dépendances optionnelles Rollup sur Windows.

### Commandes slash Claude Code
- `/dev-setup` - Configuration environnement (première fois)
- `/fix-latency` - Diagnostique et optimise la latence
- `/test-pipeline` - Tests complets du pipeline audio
- `/debug-api` - Debug problèmes STT/Translation/TTS
- `/build-release` - Build + packaging multi-plateforme
- `/review-code` - Code review avec focus performance/sécurité

## Agents spécialisés disponibles

Utilisez ces agents pour expertise spécifique:

- **`electron-expert`** - IPC, main/renderer, sécurité Electron
- **`audio-pipeline-expert`** - Streaming, buffering, latence, Ring Buffer
- **`cloud-services-expert`** - Google Cloud APIs, DeepL, coûts, retry logic
- **`typescript-expert`** - Types stricts, Zod, async patterns
- **`testing-expert`** - Vitest, Playwright, mocks, coverage
- **`react-ui-expert`** - Zustand, hooks IPC, TailwindCSS

## Architecture critique

### Pipeline Audio (src/main/pipeline/)
```
YouTube → Audio Capture → STT → Translation → TTS → Audio Output
          (100ms)         (400ms) (300ms)      (600ms) (100ms)
```

**Components clés**:
- `audio-pipeline.ts` - Orchestration générale, event bus
- `ring-buffer.ts` - Buffer circulaire avec backpressure
- `adaptive-chunker.ts` - Ajuste chunk size selon latence
- `services/` - Interfaces vers Google Cloud + DeepL

### IPC Communication (src/preload/ + src/main/ipc/)
```typescript
// Renderer → Main
window.electronAPI.startTranslation(url)
window.electronAPI.stopTranslation()

// Main → Renderer (events)
window.electronAPI.onLatencyUpdate((latency) => { ... })
window.electronAPI.onTranscriptUpdate((text) => { ... })
```

### State Management (src/renderer/store/)
```typescript
// Zustand store centralisé
const { status, currentLatency, metrics } = useTranslatorStore();
```

## Conventions de code

### Nommage
- **Fichiers**: `kebab-case.ts` (audio-pipeline.ts)
- **Classes**: `PascalCase` (AudioPipeline)
- **Fonctions**: `camelCase` (startTranslation)
- **Constantes**: `UPPER_SNAKE_CASE` (MAX_LATENCY)
- **Types/Interfaces**: `PascalCase` (TranslationRequest)

### Structure imports
```typescript
// 1. Node.js built-ins
import { pipeline } from 'stream';

// 2. External dependencies
import { z } from 'zod';

// 3. Internal modules (@main, @renderer, @shared)
import { AudioPipeline } from '@main/pipeline/audio-pipeline';

// 4. Relative imports
import { RingBuffer } from './ring-buffer';

// 5. Types
import type { TranslationRequest } from '@shared/types';
```

### Alias imports configurés
```typescript
@main     → src/main
@renderer → src/renderer
@shared   → src/shared
@preload  → src/preload
```

## Points d'attention critiques

### 1. Latence (< 2000ms target)

**Toujours surveiller**:
- Utiliser `LatencyMonitor` dans chaque stage du pipeline
- Logger les latences avec `logger.info({ stage, duration, ... })`
- Activer caches (LRU) pour traductions répétées
- Adaptive chunking actif (ajuster selon latence réelle)

**Bottlenecks communs**:
- STT: Réduire taille chunks si latence > 500ms
- Translation: Vérifier cache hit ratio (target > 20%)
- TTS: Précharger voix Neural2 au démarrage
- Network: Circuit Breaker actif si API lente

### 2. Coûts API (Budget ~$70/mois)

**Monitoring obligatoire**:
- Tracker tous les appels API dans `src/main/services/budget-tracker.ts`
- Logs structurés: `logger.info({ service, cost, charCount, ... })`
- Alertes si dépassement quotas (voir hooks)

**Optimisations**:
- Cache LRU pour traductions identiques (hit ratio > 20%)
- Batch requests quand possible
- Limiter sample rate STT à 16kHz (suffisant pour voix)
- Google Cloud: Model `latest_short` (moins cher que `latest_long`)

### 3. Error Handling

**Patterns obligatoires**:

```typescript
// ✅ Bon : Circuit Breaker + Retry
const circuitBreaker = new CircuitBreaker(5, 60000);

try {
  const result = await circuitBreaker.execute(() =>
    retryWithBackoff(() => apiService.call(), 3)
  );
} catch (error) {
  if (error instanceof APIError) {
    logger.error('API Error:', { service, error });
    // Fallback ou propagation
  }
}

// ✅ Bon : Type-safe error handling
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

function parseConfig(raw: unknown): Result<AppConfig> {
  try {
    const config = ConfigSchema.parse(raw);
    return { ok: true, value: config };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}
```

**Jamais**:
- Try-catch vide sans logging
- Retry infini sans Circuit Breaker
- Ignorer erreurs réseau/API

### 4. Sécurité Electron

**Toujours respecter**:
```typescript
// ✅ Configuration sécurisée (src/main/index.ts)
webPreferences: {
  nodeIntegration: false,      // ✅ OBLIGATOIRE
  contextIsolation: true,      // ✅ OBLIGATOIRE
  sandbox: true,               // ✅ OBLIGATOIRE
  preload: path.join(__dirname, 'preload.js'),
}

// ✅ Preload : Validation stricte
contextBridge.exposeInMainWorld('electronAPI', {
  startTranslation: (url: string) => {
    if (!isYouTubeURL(url)) {
      throw new Error('Invalid YouTube URL');
    }
    return ipcRenderer.invoke('translation:start', url);
  },
});
```

**Jamais**:
- `nodeIntegration: true` dans renderer
- `contextIsolation: false`
- Exposer APIs Node.js directement au renderer
- Secrets dans renderer (toujours main process + .env)

### 5. Types TypeScript

**Strictness obligatoire**:
```typescript
// tsconfig.json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

**Patterns requis**:
```typescript
// Branded types pour sécurité
export type YouTubeURL = string & { __brand: 'YouTubeURL' };

// Zod validation
const ConfigSchema = z.object({ ... });
export type AppConfig = z.infer<typeof ConfigSchema>;

// Éviter `any` : Utiliser `unknown` + type guards
function handleData(data: unknown): void {
  if (isValidData(data)) {
    processData(data); // Type narrowed
  }
}
```

### 6. Memory Management

**Cleanup obligatoire**:
```typescript
// React hooks
useEffect(() => {
  const unsubscribe = window.electronAPI.onLatencyUpdate(handleLatency);
  return () => unsubscribe(); // ✅ Cleanup
}, []);

// Ring Buffer : Limite explicite
const buffer = new RingBuffer<Buffer>(10); // Max 10 items
if (buffer.isFull()) {
  eventBus.emit('backpressure');
  // Appliquer stratégie backpressure
}

// Streams : Gestion backpressure
audioStream.pipe(sttTransform, { end: false });
sttTransform.on('error', (error) => {
  audioStream.unpipe(sttTransform); // ✅ Cleanup
});
```

### 7. Testing

**Coverage target : 80%+**

```bash
# Tests obligatoires avant commit
npm test              # Unit tests
npm run test:e2e      # E2E tests
npm run test:coverage # Vérifier coverage
```

**Patterns**:
- Unit (70%) : Services isolés avec mocks
- Integration (20%) : Pipeline bout-en-bout avec services réels mockés
- E2E (10%) : Playwright avec app complète

**Tests critiques**:
- Latence totale < 2000ms (avec mock services)
- Circuit Breaker déclenche après 5 failures
- Cache hit ratio > 20% sur traductions répétées
- Backpressure correcte sur Ring Buffer plein

## Fichiers importants

### Documentation de référence
- `architecture.md` - Architecture détaillée, patterns, décisions
- `tech_stack.md` - Stack complet, configurations, setup
- `deployment-guide.md` - Build, packaging, release

### Configuration
- `.env.example` - Template variables environnement
- `tsconfig.json` - Configuration TypeScript stricte
- `electron-builder.yml` - Packaging multi-plateforme
- `.github/workflows/ci.yml` - CI/CD automatisé

### Code essentiel
- `src/main/pipeline/audio-pipeline.ts` - Orchestration pipeline
- `src/main/services/` - Intégrations Google Cloud + DeepL
- `src/preload/index.ts` - IPC bridge sécurisé
- `src/renderer/store/translator-store.ts` - State Zustand
- `src/shared/types/` - Types partagés main/renderer

## Workflow recommandé (EPCT)

1. **Explore** - Utiliser agents spécialisés pour comprendre architecture
2. **Plan** - Définir approche, identifier points de modification
3. **Code** - Implémenter avec TypeScript strict + tests
4. **Test** - Valider avec `/test-pipeline` et tests E2E

## Problèmes courants

### Latence > 2000ms
→ `/fix-latency` pour diagnostique détaillé

### Erreurs API (429, 500, auth)
→ `/debug-api` pour workflow de debug

### Tests échouent
→ Vérifier mocks sont à jour avec interfaces réelles

### Build failed
→ Vérifier electron-builder.yml et credentials code signing

## Support

- **Logs**: `src/main/utils/logger.ts` (structured logging)
- **Debugging**: Chrome DevTools (Renderer) + VSCode (Main)
- **Profiling**: Chrome DevTools Performance tab pour identifier bottlenecks

---

**Note**: Cette configuration Claude Code inclut hooks de sécurité (pre-tool), auto-formatting (post-tool), et notifications. Mode `accept_edit` activé pour éditions automatiques.
