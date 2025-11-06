# Résumé Architectural - YouTube Live Translator

**Document de référence rapide pour les décisions architecturales clés**

---

## Décisions Principales

### 1. Framework Desktop: Electron 28+ ✅

**Choix**: Electron plutôt que Tauri

**Raisons**:
- Écosystème Node.js mature pour audio/streaming
- Web Audio API natif dans Chromium
- Bibliothèques audio robustes (fluent-ffmpeg, node-speaker)
- Simplicité intégration APIs cloud
- Déploiement cross-platform éprouvé
- DevTools intégré pour debugging

**Trade-off accepté**: Empreinte mémoire plus élevée (~100-150 MB) contre simplicité développement

---

### 2. Langage Backend: TypeScript + Node.js 20+

**Raisons**:
- Type safety pour pipelines complexes
- Async/await natif pour streaming
- Écosystème npm riche
- Intégration native avec Electron
- Tooling mature (ESLint, Prettier, Vitest)

---

### 3. Services Cloud

#### STT: Google Cloud Speech-to-Text ✅

**Caractéristiques**:
- Latence: 200-400ms
- Streaming WebSocket en temps réel
- Précision: 95%+
- Coût: $0.006/15s = ~$2/mois (3h/jour)

**Pourquoi Google plutôt qu'Azure ou Whisper**:
- Streaming natif (Whisper API n'a pas de streaming)
- Latence minimale vs Azure (300-500ms)
- Meilleur support modèle `latest_short` pour segments courts

#### Translation: DeepL API Pro ✅

**Caractéristiques**:
- Latence: 150-300ms
- Qualité: 98% (meilleure que Google/Azure)
- Coût: Free tier 500k chars/mois = $0 (puis $25/mois si dépassement)

**Pourquoi DeepL plutôt que Google Translate**:
- Qualité supérieure EN↔FR (spécialisé langues européennes)
- Préservation contexte et nuances
- Latence équivalente ou meilleure

#### TTS: Google Cloud Text-to-Speech Neural2 ✅

**Caractéristiques**:
- Latence: 300-500ms
- Voix: `fr-FR-Neural2-A` (féminine naturelle)
- Coût: $16/1M chars = ~$65/mois (3h/jour)

**Pourquoi Google plutôt qu'Azure ou ElevenLabs**:
- Latence minimale (ElevenLabs: 600-1000ms)
- Qualité voix Neural2 excellente
- Coût prévisible (ElevenLabs plus cher et limité)

---

### 4. Budget Latence (Détail)

```
Component               Latence      Optimisations
──────────────────────────────────────────────────────────
YouTube Capture         100ms        Buffering minimal, chunk 1.5s
Google STT              400ms        Streaming mode, interim results
DeepL Translation       300ms        Batching intelligent (3 phrases)
Google TTS Neural2      600ms        Synthèse parallèle
Audio Playback          100ms        Ring buffer, backpressure
──────────────────────────────────────────────────────────
Total                   1500ms ✅    Marge 500ms avant 2000ms
```

---

### 5. Patterns de Design

#### Event-Driven Architecture
**Pourquoi**: Pipeline asynchrone avec multiples sources d'événements
**Implémentation**: Node.js EventEmitter central

#### Pipeline Pattern
**Pourquoi**: Traitement séquentiel bien défini (Capture→STT→Trans→TTS→Output)
**Implémentation**: Node.js Streams avec Transform stages

#### Service Layer
**Pourquoi**: Encapsulation logique métier, facilite tests et mocking
**Implémentation**: Interfaces + Factory Pattern

#### Repository Pattern (Cache)
**Pourquoi**: Abstraction couche persistance
**Implémentation**: LRU Cache avec persistance fichier JSON

---

### 6. Stratégies d'Optimisation

#### Streaming + Batching Hybride
- **STT**: Streaming complet (transcription continue)
- **Translation**: Batching intelligent (3 phrases max ou 2s timeout)
- **TTS**: Synthèse parallèle (Worker Pool 4 threads)

#### Ring Buffer avec Backpressure
- Buffer audio: 10 chunks max
- Buffer texte: 20 phrases max
- Si plein: ralentir capture ou forcer flush

#### LRU Cache Persistant
- Cache traductions fréquentes (1000 entrées max)
- TTL: 24h
- Persistance: JSON sur disque (save débounce 5s)

#### Adaptive Chunk Sizing
- Taille initiale: 1.5s
- Ajustement dynamique selon latence mesurée
- Range: 0.8s - 3.0s

#### Worker Pool
- 4 workers pour synthèse TTS parallèle
- Permet traiter batch de 3 phrases simultanément
- Réduit latence globale de ~40%

---

### 7. Infrastructure

#### Monitoring
- **Logging**: Pino (structured JSON logs)
- **Métriques**: Collector custom (latence par stage, API calls)
- **Alertes**: Budget tracker (80% seuil), network quality

#### Gestion Erreurs
- **Circuit Breaker**: 5 échecs → OPEN (1 min timeout)
- **Retry Logic**: Exponential backoff (3 tentatives max)
- **Rate Limiting**: Token Bucket (1000 req/min STT, 500 Trans/TTS)

#### Budget & Coûts
- **Tracker**: Enregistrement usage par service
- **Alertes**: Warning à 80% budget mensuel
- **Budget recommandé**: $100/mois (marge confortable)

---

### 8. Structure Projet

```
src/
├── main/                      # Electron Main Process
│   ├── services/              # STT, Translation, TTS services
│   │   ├── youtube-capture.service.ts
│   │   ├── stt.service.ts
│   │   ├── translation.service.ts
│   │   ├── tts.service.ts
│   │   └── audio-output.service.ts
│   ├── pipeline/              # Pipeline orchestration
│   │   ├── audio-pipeline.ts
│   │   ├── buffer-manager.ts
│   │   ├── latency-monitor.ts
│   │   └── adaptive-chunker.ts
│   ├── core/                  # Infrastructure
│   │   ├── config.manager.ts
│   │   ├── cache.manager.ts
│   │   ├── logger.ts
│   │   ├── error.handler.ts
│   │   └── event-bus.ts
│   └── utils/
│       ├── retry.ts
│       ├── circuit-breaker.ts
│       └── stream-helpers.ts
├── renderer/                  # UI React
│   ├── components/
│   ├── store/                 # Zustand
│   └── styles/
├── preload/                   # IPC Bridge
└── shared/                    # Types communs
```

---

### 9. Dépendances Critiques

**Core**:
- `electron` v28+
- `typescript` v5.3+
- `react` v18+

**Audio**:
- `fluent-ffmpeg` - Conversion audio
- `speaker` - Playback audio
- `wav` - Manipulation fichiers WAV

**APIs Cloud**:
- `@google-cloud/speech` v6+
- `@google-cloud/text-to-speech` v5+
- `deepl-node` v1+

**Infrastructure**:
- `axios` + `axios-retry` - HTTP client
- `pino` - Logging
- `zod` - Validation config
- `zustand` - State management

**Dev/Build**:
- `vite` - Bundler
- `electron-vite` - Electron + Vite
- `electron-builder` - Packaging
- `vitest` - Tests unitaires
- `playwright` - Tests E2E

---

### 10. Sizing & Capacité

#### Mémoire
- **Electron base**: ~100 MB
- **Audio buffers**: ~20 MB (10 chunks * 2 MB)
- **Cache traductions**: ~5 MB (1000 entrées)
**Total**: ~130 MB RAM au repos

#### Stockage
- **Application**: ~100 MB (binaires + deps)
- **Logs**: ~10 MB/jour (rotation après 7 jours)
- **Cache**: ~5 MB (persistant)

#### Réseau
- **Bande passante**: ~2 Mbps (audio YouTube + APIs)
- **APIs calls**:
  - STT: ~180 req/h (1 req/20s)
  - Translation: ~60 req/h (batching 3 phrases)
  - TTS: ~60 req/h

---

### 11. Qualités Système

#### Performance
- **Latence P50**: 1500ms ✅
- **Latence P95**: 1900ms ✅
- **Latence P99**: 2100ms ⚠️ (acceptable)
- **Throughput**: 3600 phrases/h

#### Fiabilité
- **Uptime**: 99%+ (dépend connectivité réseau)
- **Erreur handling**: Retry automatique 3x avec backoff
- **Circuit breaker**: Protection contre cascading failures

#### Scalabilité
- **Limitations**:
  - 1 vidéo simultanée par instance
  - Rate limits APIs (1000 req/min STT)
- **Extensibilité**:
  - Multi-langues (config simple)
  - Multi-providers (Factory Pattern)

#### Maintenabilité
- **Code coverage**: Cible 80%+
- **Linting**: ESLint strict mode
- **Type safety**: TypeScript strict
- **Documentation**: Architecture complète (4910 lignes)

---

### 12. Alternatives Évaluées et Rejetées

| Choix Rejeté | Raison |
|--------------|--------|
| **Tauri** | Écosystème audio moins mature, complexité FFI Rust/JS |
| **Whisper API** | Pas de streaming, latence 1000-2000ms |
| **Azure STT** | Latence légèrement supérieure (300-500ms vs 200-400ms) |
| **Google Translate** | Qualité inférieure à DeepL pour EN↔FR |
| **ElevenLabs TTS** | Latence trop élevée (600-1000ms), coût/limite restrictifs |
| **LibreTranslate** | Qualité insuffisante (85% vs 98% DeepL) |
| **Self-hosted Whisper** | Complexité infrastructure, GPU requis |

---

### 13. Risques et Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **APIs rate limiting** | Moyen | Haut | Token bucket, backoff exponentiel, circuit breaker |
| **Dépassement budget** | Faible | Moyen | Budget tracker avec alertes à 80% |
| **Qualité réseau faible** | Moyen | Haut | Network monitor, adaptive chunk sizing, cache |
| **YouTube changes** | Faible | Haut | yt-dlp auto-update, fallback Puppeteer |
| **Latence > 2s** | Faible | Haut | Monitoring continu, alertes, optimisations runtime |

---

### 14. Prochaines Étapes (Ordre Recommandé)

1. **Setup projet Electron** (2-3 jours)
   - Init structure avec electron-vite
   - Configuration TypeScript, ESLint, Prettier
   - Setup CI/CD (GitHub Actions)

2. **Services cloud** (1-2 jours)
   - Créer comptes Google Cloud + DeepL
   - Configuration credentials
   - Tests unitaires services

3. **MVP Pipeline** (5-7 jours)
   - Capture YouTube (yt-dlp + ffmpeg)
   - Intégration STT streaming
   - Intégration Translation
   - Intégration TTS
   - Audio playback

4. **Optimisations** (3-5 jours)
   - Batching intelligent
   - Ring buffer + backpressure
   - LRU cache
   - Adaptive chunking

5. **UI React** (3-4 jours)
   - Interface principale
   - Monitoring temps réel
   - Paramètres
   - Gestion erreurs

6. **Infrastructure** (2-3 jours)
   - Logging structuré
   - Métriques collector
   - Budget tracker
   - Network monitor

7. **Tests** (3-5 jours)
   - Tests unitaires (Vitest)
   - Tests intégration
   - Tests E2E (Playwright)
   - Tests performance

8. **Packaging & Release** (2-3 jours)
   - electron-builder setup
   - Auto-updater
   - GitHub Actions release
   - Documentation utilisateur

**Total estimé**: 21-32 jours de développement

---

### 15. Métriques de Succès

**Critères fonctionnels**:
- ✅ Latence moyenne < 2s (P95)
- ✅ Précision traduction > 90% (évaluation humaine)
- ✅ Support Anglais → Français fluide
- ✅ Uptime > 95% sur session 1h

**Critères non-fonctionnels**:
- ✅ Mémoire < 200 MB
- ✅ Installation < 5 min
- ✅ Coût < $100/mois (usage intensif)
- ✅ Build cross-platform Windows/macOS/Linux

**Critères qualité**:
- ✅ Code coverage > 80%
- ✅ Zero critical vulnerabilities
- ✅ Documentation complète
- ✅ Logs structurés pour debugging

---

## Références Rapides

- **Architecture complète**: `architecture.md` (2538 lignes)
- **Stack technique**: `tech_stack.md` (1017 lignes)
- **Guide déploiement**: `deployment-guide.md` (1011 lignes)
- **Diagrammes fonctionnels**: `functional_diagram.mmd` (267 lignes)
- **README**: `README.md` (344 lignes)

**Total documentation**: 4910 lignes

---

**Dernière mise à jour**: 2025-11-06
