# Guide de Démarrage - YouTube Live Translator

Ce document explique comment démarrer le développement de votre application après la phase de préparation.

## 📦 Ce qui a été préparé pour vous

### Documentation Technique Complète

1. **README.md** - Vue d'ensemble et guide utilisateur
2. **architecture.md** - Architecture technique détaillée (2538 lignes)
3. **tech_stack.md** - Stack et configurations (1017 lignes)
4. **deployment-guide.md** - Guide de déploiement (1011 lignes)
5. **functional_diagram.mmd** - 4 diagrammes Mermaid
6. **ARCHITECTURE_SUMMARY.md** - Référence rapide des décisions
7. **PROJECT_INDEX.md** - Index complet de la documentation

### Configuration Claude Code (`.claude/`)

**6 Agents Spécialisés** :
- `electron-expert.md` - Expert Electron/IPC
- `audio-pipeline-expert.md` - Expert pipeline audio
- `cloud-services-expert.md` - Expert APIs cloud
- `typescript-expert.md` - Expert TypeScript
- `testing-expert.md` - Expert tests
- `react-ui-expert.md` - Expert React/UI

**6 Commandes Slash** :
- `/dev-setup` - Configuration environnement
- `/fix-latency` - Optimisation latence
- `/test-pipeline` - Tests complets
- `/debug-api` - Debug APIs
- `/build-release` - Build et release
- `/review-code` - Code review

**3 Hooks de Sécurité** :
- Pre-tool : Bloque commandes dangereuses
- Post-tool : Auto-formatting Prettier
- Notification : Alertes desktop/son

**Configuration Complète** :
- `settings.json` - Permissions, hooks, conventions
- `CLAUDE.md` - Guide concis pour Claude Code

---

## 🚀 Prochaines Étapes

### Étape 1 : Créer le Repository Git

```bash
# Créer un nouveau repository pour le projet réel
cd ~/projects
git clone https://github.com/your-username/youtube-live-translator.git
cd youtube-live-translator
```

### Étape 2 : Copier la Configuration

```bash
# Copier toute la configuration préparée
cp -r /home/eric/projects/project_management/projects/youtube-live-translator/.claude .
cp /home/eric/projects/project_management/projects/youtube-live-translator/CLAUDE.md .

# Copier la documentation (optionnel, peut être dans un dossier docs/)
mkdir -p docs
cp /home/eric/projects/project_management/projects/youtube-live-translator/*.md docs/
cp /home/eric/projects/project_management/projects/youtube-live-translator/*.mmd docs/
```

### Étape 3 : Initialiser le Projet Electron

Dans votre nouveau repository `youtube-live-translator/` :

```bash
# Utiliser la commande slash de Claude Code
/dev-setup

# Ou manuellement :
npm create @quick-start/electron
# Choisir : Vite + TypeScript + React

# Installer dépendances supplémentaires (voir tech_stack.md)
npm install zustand @google-cloud/speech @google-cloud/text-to-speech deepl-node
npm install -D vitest @playwright/test eslint prettier tailwindcss
```

### Étape 4 : Configuration Services Cloud

#### Google Cloud

```bash
# 1. Créer projet
gcloud projects create youtube-live-translator
gcloud config set project youtube-live-translator

# 2. Activer APIs
gcloud services enable speech.googleapis.com texttospeech.googleapis.com

# 3. Créer service account
gcloud iam service-accounts create ytlt-service
gcloud iam service-accounts keys create ./credentials/google-cloud-key.json \
  --iam-account=ytlt-service@youtube-live-translator.iam.gserviceaccount.com

# 4. Donner permissions
gcloud projects add-iam-policy-binding youtube-live-translator \
  --member="serviceAccount:ytlt-service@youtube-live-translator.iam.gserviceaccount.com" \
  --role="roles/cloudtranslate.user"
```

#### DeepL

1. Créer compte : https://www.deepl.com/pro-api
2. Copier API Key
3. Ajouter dans `.env` : `DEEPL_API_KEY=votre_clé`

#### Fichier `.env`

```bash
# Copier template
cp docs/tech_stack.md .env.example  # Extraire section .env
nano .env  # Ajouter vos clés
```

### Étape 5 : Développement Guidé avec Claude Code

```bash
# Lancer Claude Code dans le projet
cd ~/projects/youtube-live-translator
claude

# Utiliser les commandes slash pour commencer
# "/dev-setup" va vous guider étape par étape
```

**Ordre de développement recommandé** (voir timeline dans PROJECT_INDEX.md) :

1. **Phase 1 (2-3 jours)** : Setup projet Electron + TypeScript
2. **Phase 2 (1-2 jours)** : Configuration services cloud
3. **Phase 3 (5-7 jours)** : MVP Pipeline (Capture → STT → Translation → TTS)
4. **Phase 4 (3-5 jours)** : Optimisations (cache, adaptive chunking, batching)
5. **Phase 5 (3-4 jours)** : UI React + monitoring temps réel
6. **Phase 6 (2-3 jours)** : Infrastructure (logging, métriques, budget tracker)
7. **Phase 7 (3-5 jours)** : Tests (unitaires, intégration, E2E)
8. **Phase 8 (2-3 jours)** : Packaging et release

**Total : 21-32 jours**

---

## 💡 Utiliser les Agents Spécialisés

Lors du développement, appelez les agents pour expertise :

```bash
# Dans Claude Code CLI
> Je dois implémenter le pipeline audio avec streaming
[Claude invoquera automatiquement audio-pipeline-expert]

> Comment configurer l'IPC entre main et renderer ?
[Claude invoquera electron-expert]

> J'ai des erreurs 429 sur Google Cloud STT
[Claude invoquera cloud-services-expert et /debug-api]
```

---

## 📋 Commandes Principales

### Développement

```bash
npm run dev              # Lance app avec hot reload
npm test                 # Tests unitaires (Vitest)
npm run test:e2e         # Tests E2E (Playwright)
npm run lint             # ESLint + TypeScript check
npm run format           # Prettier auto-format
```

### Commandes Slash Claude Code

- `/dev-setup` - Guide complet setup environnement
- `/fix-latency` - Si latence > 2s, diagnostic automatique
- `/test-pipeline` - Tests complets du pipeline
- `/debug-api` - Problèmes STT/Translation/TTS
- `/build-release` - Build et packaging multi-plateforme
- `/review-code` - Code review avant commit/PR

---

## 🎯 Objectifs de Performance

| Métrique | Cible | Validation |
|----------|-------|------------|
| **Latence totale** | < 2000ms | Monitor en temps réel |
| **Latence P50** | < 1500ms | Tests de performance |
| **Latence P95** | < 1900ms | Tests de charge |
| **Cache hit ratio** | > 20% | Logs structurés |
| **Test coverage** | > 80% | `npm run test:coverage` |
| **Coûts mensuels** | < $70 | Budget tracker intégré |

---

## 🛠 Outils Recommandés

### IDE
- **VS Code** avec extensions :
  - ESLint
  - Prettier
  - TypeScript
  - Vitest
  - TailwindCSS IntelliSense

### Chrome DevTools
- Profiler (Performance tab) pour identifier bottlenecks
- Memory profiler pour fuites mémoire

### Monitoring
- Logs structurés : `src/main/utils/logger.ts`
- Métriques temps réel dans UI React
- Budget tracker pour coûts API

---

## 📚 Références Rapides

### Architecture

```
YouTube Video
    ↓ (yt-dlp)
Audio Stream (opus/mp3)
    ↓ (Ring Buffer)
STT Service (Google, 400ms)
    ↓
Translation (DeepL, 300ms)
    ↓
TTS Service (Google Neural2, 600ms)
    ↓ (Web Audio API)
Audio Output (translated)
```

### Budget Latence (Validé ✅)

```
Capture YouTube:       100ms
STT (Google):          400ms
Translation (DeepL):   300ms
TTS (Google Neural2):  600ms
Audio Playback:        100ms
──────────────────────────────
Total:                 1500ms  (< 2000ms ✅)
Marge:                  500ms  (25%)
```

### Structure Projet

```
src/
├── main/              # Electron main process (Node.js)
│   ├── services/      # STT, Translation, TTS
│   ├── pipeline/      # Audio pipeline, buffering
│   ├── core/          # Config, logging, cache
│   └── utils/         # Retry, streams, helpers
├── renderer/          # UI React
├── preload/           # IPC bridge sécurisé
└── shared/            # Types, constantes partagés
```

---

## ⚠️ Points d'Attention Critiques

1. **Latence** : Monitorer en temps réel, activer cache, adaptive chunking
2. **Coûts API** : Budget tracker actif, alertes si dépassement
3. **Sécurité Electron** : `nodeIntegration: false`, `contextIsolation: true`
4. **Error Handling** : Circuit Breaker + Retry Logic sur tous les appels API
5. **Types TypeScript** : Mode strict, Zod validation, pas de `any`
6. **Memory** : Cleanup listeners React, Ring Buffer avec limite, backpressure

---

## 🐛 Troubleshooting

### Latence > 2 secondes

```bash
/fix-latency
# Ou manuellement :
# - Réduire chunk size
# - Activer cache traductions
# - Vérifier qualité réseau
# - Profiler avec Chrome DevTools
```

### Erreurs API (429, 500, auth)

```bash
/debug-api
# Vérifie :
# - Credentials Google Cloud
# - Quotas API
# - Rate limiting
# - Circuit Breaker logs
```

### Build failed

```bash
# Vérifier electron-builder.yml
# Vérifier certificats code signing (macOS/Windows)
# Vérifier .env variables
```

---

## 📞 Support

- **Documentation complète** : Dossier `docs/`
- **Architecture** : `docs/architecture.md`
- **Stack technique** : `docs/tech_stack.md`
- **Déploiement** : `docs/deployment-guide.md`
- **Claude Code** : `CLAUDE.md` (guide concis)

---

## ✅ Checklist Avant de Commencer

- [ ] Repository Git créé
- [ ] Configuration `.claude/` copiée
- [ ] `CLAUDE.md` copié
- [ ] Node.js 20+ installé
- [ ] Compte Google Cloud créé
- [ ] Compte DeepL créé
- [ ] APIs activées (Speech, Text-to-Speech)
- [ ] Service account créé avec credentials
- [ ] `.env` configuré avec toutes les clés
- [ ] `npm install` exécuté avec succès
- [ ] `/dev-setup` exécuté dans Claude Code

---

**Prêt à développer !** 🚀

La prochaine étape est simplement de :
1. Créer votre repository
2. Copier cette configuration
3. Lancer `/dev-setup` dans Claude Code
4. Suivre le guide étape par étape

Bon développement ! 🎉
