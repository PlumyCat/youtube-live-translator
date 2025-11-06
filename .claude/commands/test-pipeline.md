# Commande : test-pipeline

Teste le pipeline audio complet de bout en bout.

## Objectif

Valider chaque étape du pipeline : YouTube → STT → Translation → TTS → Audio Output

## Workflow de Test

### 1. Tests Unitaires (Services Isolés)

#### Test STT Service
```bash
# Tester Google STT
npm test -- tests/unit/services/stt.service.test.ts

# Vérifier :
# - Stream creation OK
# - Transcription accuracy
# - Error handling
# - Latency < 500ms
```

#### Test Translation Service
```bash
# Tester DeepL
npm test -- tests/unit/services/translation.service.test.ts

# Vérifier :
# - Translation correcte EN→FR
# - Cache hit/miss
# - Batch translation
# - Latency < 400ms
```

#### Test TTS Service
```bash
# Tester Google TTS
npm test -- tests/unit/services/tts.service.test.ts

# Vérifier :
# - Audio synthesis OK
# - Buffer size correct
# - Cache fonctionne
# - Latency < 700ms
```

### 2. Tests d'Intégration (Pipeline Complet)

#### Test Pipeline End-to-End
```bash
npm test -- tests/integration/pipeline.test.ts

# Test avec mock audio stream
# Vérifier :
# - Latency totale < 2000ms
# - Tous stages s'exécutent
# - Events émis correctement
# - Cleanup propre
```

#### Test avec Vraie Vidéo YouTube
```bash
# Test manuel avec URL courte
npm run dev

# Dans UI :
# 1. Entrer URL : https://youtube.com/watch?v=dQw4w9WgXcQ
# 2. Cliquer "Démarrer"
# 3. Observer :
#    - Status change : idle → capturing → processing
#    - Latency updates temps réel
#    - Audio traduit joue correctement
#    - Pas d'erreurs console
```

### 3. Tests de Charge

#### Test Durée (30 minutes)
```bash
# Lancer avec vidéo longue
npm run dev

# Vérifier :
# - Pas de memory leaks
# - Latency stable
# - Pas de crashes
# - CPU/RAM raisonnable
```

**Métriques à surveiller** :
```bash
# Ouvrir DevTools > Performance Monitor
# Observer pendant 30 min :
# - CPU usage < 50%
# - Memory < 500MB
# - Latency moyenne stable
```

#### Test Stress (Switching rapide)
```typescript
// Test automatisé
describe('Pipeline Stress Test', () => {
  it('should handle rapid start/stop cycles', async () => {
    const pipeline = new AudioPipeline();

    for (let i = 0; i < 10; i++) {
      await pipeline.start(mockStream);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await pipeline.stop();
    }

    // Vérifier pas de leaks
    expect(pipeline.isHealthy()).toBe(true);
  });
});
```

### 4. Tests de Cas Limites

#### Test Error Handling

**API Failure**
```typescript
// Mock API failure
vi.spyOn(sttService, 'transcribe')
  .mockRejectedValue(new Error('API Down'));

// Vérifier :
# - Circuit breaker active
# - Retry logic fonctionne
# - Erreur affichée UI
# - Pipeline recoverable
```

**Network Timeout**
```typescript
// Mock network slow/timeout
vi.spyOn(axios, 'post')
  .mockImplementation(() => new Promise((resolve) => {
    setTimeout(() => resolve(mockResponse), 10000); // 10s timeout
  }));

// Vérifier :
# - Timeout handled
# - Fallback activé
# - User notified
```

**Invalid YouTube URL**
```bash
# Test dans UI :
# URL : "https://invalid-url.com"
# Vérifier :
# - Erreur claire affichée
# - Status revient à idle
# - Pas de crash
```

**YouTube Video Unavailable**
```bash
# URL vidéo privée/supprimée
# Vérifier :
# - Erreur détectée rapidement
# - Message clair
# - Cleanup correct
```

### 5. Tests de Performance

#### Benchmark Latency
```typescript
// tests/performance/latency.bench.ts
import { describe, bench } from 'vitest';

describe('Pipeline Latency Benchmarks', () => {
  bench('STT transcription', async () => {
    const audioChunk = createMockAudioChunk(1500); // 1.5s audio
    await sttService.transcribe(audioChunk);
  });

  bench('Translation EN→FR', async () => {
    const text = 'Hello, how are you today?';
    await translationService.translate(text, 'en', 'fr');
  });

  bench('TTS synthesis', async () => {
    const text = 'Bonjour, comment allez-vous?';
    await ttsService.synthesize(text);
  });

  bench('End-to-end pipeline', async () => {
    const mockStream = createMockAudioStream(5000); // 5s
    await pipeline.start(mockStream);
  });
});
```

```bash
# Lancer benchmarks
npm run test:benchmark

# Résultats attendus :
# STT: < 500ms
# Translation: < 400ms
# TTS: < 700ms
# E2E: < 2000ms
```

### 6. Tests E2E (Playwright)

```bash
npm run test:e2e

# Tests automatisés :
# - Full translation flow
# - Start/Stop controls
# - Error handling UI
# - Latency monitoring
# - Metrics dashboard
```

### 7. Validation Qualité

#### Qualité Audio
```bash
# Écouter audio généré
# Vérifier :
# - Pas de distorsion
# - Synchronisation correcte
# - Volume approprié
# - Pas de coupures
```

#### Qualité Traduction
```bash
# Comparer traductions
# Phrases test :
phrases = [
  "Hello, how are you?" → "Bonjour, comment allez-vous ?"
  "Thank you very much" → "Merci beaucoup"
  "I don't understand" → "Je ne comprends pas"
  "What is your name?" → "Comment vous appelez-vous ?"
]

# Vérifier :
# - Sens préservé
# - Grammaire correcte
# - Contexte respecté
```

## Checklist Complète

### Tests Automatisés
- [ ] Tests unitaires passent (100%)
- [ ] Tests intégration passent
- [ ] Tests E2E passent
- [ ] Coverage > 80%
- [ ] Benchmarks dans seuils

### Tests Manuels
- [ ] Test avec vraie vidéo 5 min
- [ ] Test avec vraie vidéo 30 min
- [ ] Test start/stop rapide
- [ ] Test errors (URL invalide, network down)
- [ ] Test qualité audio
- [ ] Test qualité traduction

### Métriques
- [ ] Latency < 2000ms stable
- [ ] CPU < 50%
- [ ] Memory < 500MB
- [ ] Pas de memory leaks
- [ ] Cache hit ratio > 20%

## Rapports

### Générer Rapport Coverage
```bash
npm run test:coverage
open coverage/index.html
```

### Générer Rapport E2E
```bash
npm run test:e2e
open test-results/html/index.html
```

### Export Métriques
```bash
# Dans app running
window.electronAPI.exportMetrics()
  .then(metrics => {
    console.log(JSON.stringify(metrics, null, 2));
  });

# Sauvegarder dans metrics-report.json
```

## Résultats Attendus

**Tests Unitaires** :
```
PASS  tests/unit/services/stt.service.test.ts
PASS  tests/unit/services/translation.service.test.ts
PASS  tests/unit/services/tts.service.test.ts
PASS  tests/unit/pipeline/ring-buffer.test.ts
PASS  tests/unit/pipeline/latency-monitor.test.ts

Test Suites: 5 passed, 5 total
Tests:       42 passed, 42 total
Coverage:    85.3% (target: 80%)
```

**Tests Intégration** :
```
PASS  tests/integration/pipeline.test.ts
  ✓ should process audio under 2s latency (1450ms)
  ✓ should handle errors gracefully
  ✓ should cleanup correctly on stop
```

**Tests E2E** :
```
PASS  tests/e2e/translation-flow.spec.ts
  ✓ should start translation successfully
  ✓ should display error for invalid URL
  ✓ should stop translation cleanly
  ✓ should update latency in real-time
```

Pipeline validé et prêt pour production !
