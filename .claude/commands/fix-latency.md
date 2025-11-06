# Commande : fix-latency

Diagnostique et optimise la latence du pipeline audio.

## Objectif

Maintenir latence totale < 2000ms (objectif : < 1500ms optimal)

## Workflow de Diagnostic

### 1. Mesurer Latence Actuelle

#### Lancer monitoring
```bash
# Terminal 1 : Lancer app
npm run dev

# Terminal 2 : Tail logs
tail -f ~/.config/youtube-live-translator/logs/app.log | grep latency
```

#### Observer métriques
- Latence par stage (capture, STT, translation, TTS, output)
- Latence totale end-to-end
- Variations sur 1-2 minutes

### 2. Identifier Goulots d'Étranglement

#### Analyse par stage

**STT (Speech-to-Text)**
- Latence attendue : 200-400ms
- Si > 500ms :
  - Vérifier `model: 'latest_short'` dans config STT
  - Vérifier `interimResults: true` activé
  - Tester connexion réseau vers Google Cloud
  - Vérifier rate limiting

**Translation (DeepL)**
- Latence attendue : 150-300ms
- Si > 400ms :
  - Vérifier cache hit ratio : `logger.info('cache hit')`
  - Tester batch translation si séquentiel
  - Vérifier réseau vers DeepL API
  - Vérifier quotas DeepL

**TTS (Text-to-Speech)**
- Latence attendue : 400-700ms
- Si > 800ms :
  - Vérifier `speakingRate: 1.1` (plus rapide)
  - Tester cache pour phrases courantes
  - Vérifier synthèse parallèle activée
  - Tester voix Standard vs Neural2 (Standard plus rapide)

**Capture YouTube**
- Latence attendue : 100-200ms
- Si > 300ms :
  - Vérifier chunk size (1500ms optimal)
  - Tester qualité vidéo (bestaudio peut être lourd)
  - Vérifier yt-dlp version récente

### 3. Optimisations par Ordre de Priorité

#### Optimisation 1 : Adaptive Chunk Sizing
```typescript
// Activer dans config
const adaptiveChunker = new AdaptiveAudioChunker();

eventBus.on('latency-update', (latency) => {
  adaptiveChunker.adjustChunkSize(latency);
});
```

**Impact** : Réduit latence 10-20% selon réseau

#### Optimisation 2 : Cache Aggressive
```typescript
// Augmenter taille cache LRU
const translationCache = new LRUCache(2000); // vs 1000

// Activer cache TTS
const ttsCache = new Map<string, Buffer>();
```

**Impact** : Réduit latence 30-50% pour phrases répétées

#### Optimisation 3 : Parallélisation TTS
```typescript
// Synthétiser plusieurs phrases en parallèle
async function synthesizeMultiple(texts: string[]): Promise<Buffer[]> {
  const promises = texts.map(text => ttsService.synthesize(text));
  return Promise.all(promises);
}
```

**Impact** : Réduit latence moyenne 20-30%

#### Optimisation 4 : Batching Translation
```typescript
// Batch 3 phrases ensemble
const batchProcessor = new BatchProcessor({
  maxSize: 3,
  maxWaitTime: 2000,
  processor: async (texts) => {
    return translationService.translateBatch(texts);
  }
});
```

**Impact** : Réduit overhead HTTP, gain 10-15%

#### Optimisation 5 : Worker Threads Audio
```typescript
// Offload traitement audio lourd
const audioWorker = new Worker('./audio-processor.worker.js');

audioWorker.postMessage({ chunk: audioBuffer });
```

**Impact** : Évite blocking main thread, gain 5-10%

### 4. Configuration Réseau

#### Vérifier qualité connexion
```bash
# Ping Google Cloud
ping -c 10 speech.googleapis.com

# Ping DeepL
ping -c 10 api.deepl.com

# Si latency > 100ms : problème réseau potentiel
```

#### Ajuster timeouts si réseau lent
```typescript
// Dans config
const apiClient = axios.create({
  timeout: 5000, // Augmenter si réseau lent
});
```

### 5. Fallback Services

#### Si latency persistante sur un service
```typescript
// Configuration multi-provider
const serviceFactory = new ServiceFactory();

// Essayer Azure si Google lent
if (avgLatency > 2000) {
  sttService = serviceFactory.createSTT('azure');
  ttsService = serviceFactory.createTTS('azure');
}
```

### 6. Tests de Performance

#### Benchmark latency
```bash
# Lancer test performance
npm run test:performance

# Ou test manuel
npm run dev
# Tester avec URL YouTube courte (30s-1min)
# Observer latency pendant 2-3 minutes
# Vérifier stabilité
```

#### Critères de succès
- Latence moyenne < 1500ms
- Latence max < 2000ms (99th percentile)
- Pas de dégradation sur durée
- Cache hit ratio > 20%

## Checklist Optimisation

- [ ] Mesurer latency baseline
- [ ] Identifier stage le plus lent
- [ ] Activer adaptive chunking
- [ ] Augmenter cache sizes
- [ ] Tester parallélisation TTS
- [ ] Activer batching translation
- [ ] Vérifier qualité réseau
- [ ] Tester sur durée (5+ minutes)
- [ ] Vérifier latency < 2000ms stable

## Résultats Attendus

**Avant optimisation** :
```
Capture: 150ms
STT: 500ms
Translation: 400ms
TTS: 800ms
Output: 100ms
-------------------
Total: 1950ms ⚠️
```

**Après optimisation** :
```
Capture: 100ms
STT: 350ms (cache + model)
Translation: 250ms (cache + batch)
TTS: 550ms (cache + parallel)
Output: 80ms
-------------------
Total: 1330ms ✅
```

**Gain** : ~30% réduction latency

## Monitoring Continu

```typescript
// Alertes si latency > seuil
eventBus.on('latency-update', (latency) => {
  if (latency > 2000) {
    logger.warn(`High latency detected: ${latency}ms`);
    // Déclencher optimisation auto
    optimizationService.adjustSettings();
  }
});
```

Objectif : Maintenir latency optimale en temps réel.
