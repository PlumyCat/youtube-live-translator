# YouTube Live Translator

> Application desktop de traduction en temps réel pour vidéos YouTube (Anglais → Français)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-28+-9feaf9.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178c6.svg)

---

## Vue d'Ensemble

**YouTube Live Translator** est une application desktop qui traduit en temps réel l'audio de vidéos YouTube avec une latence cible inférieure à 2 secondes.

### Fonctionnalités Principales

- **Traduction en temps réel**: Latence < 2 secondes (Anglais → Français)
- **Pipeline optimisé**: Capture YouTube → STT → Translation → TTS → Audio output
- **Qualité premium**: Services cloud professionnels (Google Cloud, DeepL)
- **Interface intuitive**: UI React moderne avec monitoring temps réel
- **Multi-plateforme**: Windows, macOS, Linux

### Cas d'Usage

- Suivre des conférences techniques en anglais
- Regarder des tutoriels YouTube en comprenant en temps réel
- Apprendre une langue via immersion avec traduction
- Accessibilité pour personnes malentendantes

---

## Architecture Technique

### Stack Technologique

**Framework**: Electron 28+ (Chromium 120+, Node.js 20+)
**Backend**: TypeScript + Node.js
**Frontend**: React 18 + TailwindCSS
**Services Cloud**:
- **STT**: Google Cloud Speech-to-Text (streaming, latence 200-400ms)
- **Translation**: DeepL API Pro (qualité supérieure, 150-300ms)
- **TTS**: Google Cloud Text-to-Speech Neural2 (voix naturelles, 300-500ms)

### Budget Latence

```
Capture YouTube:        100ms
STT (Google):           400ms
Translation (DeepL):    300ms
TTS (Google Neural2):   600ms
Audio Playback:         100ms
-----------------------------------
Total:                  1500ms ✅ < 2000ms
```

### Coûts Estimés

**Usage intensif (3h/jour)**:
- STT: ~$2/mois
- Translation: Free tier DeepL (500k chars/mois)
- TTS: ~$65/mois
**Total**: ~$70/mois

**Alternatives budget réduit**: ~$25/mois (voir `architecture.md`)

---

## Installation Rapide

### Prérequis

- **Node.js** 20+
- **npm** ou **yarn**
- Compte **Google Cloud** (Free tier OK)
- Compte **DeepL** (Free tier OK)

### Installation

```bash
# 1. Cloner le repository
git clone https://github.com/your-username/youtube-live-translator.git
cd youtube-live-translator

# 2. Installer les dépendances
npm install

# 3. Installer binaires externes (yt-dlp, ffmpeg)
npm run install:deps

# 4. Configurer les clés API
cp .env.example .env
nano .env  # Ajouter vos clés API

# 5. Lancer l'application
npm run dev
```

### Configuration des Services Cloud

#### Google Cloud

```bash
# Installer gcloud CLI
curl https://sdk.cloud.google.com | bash

# Créer projet et activer APIs
gcloud projects create youtube-live-translator
gcloud config set project youtube-live-translator
gcloud services enable speech.googleapis.com texttospeech.googleapis.com

# Créer service account et télécharger clé
gcloud iam service-accounts create ytlt-service
gcloud iam service-accounts keys create ./credentials/google-cloud-key.json \
  --iam-account=ytlt-service@youtube-live-translator.iam.gserviceaccount.com
```

#### DeepL

1. Créer compte sur https://www.deepl.com/pro-api
2. Copier API Key
3. Ajouter dans `.env`: `DEEPL_API_KEY=your_key_here`

Pour plus de détails, voir [`deployment-guide.md`](./deployment-guide.md).

---

## Utilisation

### Démarrer la Traduction

1. Lancer l'application
2. Coller l'URL YouTube (ex: `https://youtube.com/watch?v=...`)
3. Cliquer sur "Démarrer"
4. L'audio traduit est joué en temps réel

### Interface

- **Champ URL**: Coller l'URL YouTube
- **Bouton Démarrer/Arrêter**: Contrôle de la traduction
- **Indicateur de latence**: Affiche latence actuelle (vert < 2s, rouge > 2s)
- **Console logs**: Affiche événements en temps réel
- **Paramètres**: Configuration langues, services, chunk size

---

## Développement

### Structure du Projet

```
youtube-live-translator/
├── src/
│   ├── main/              # Electron main process (Node.js)
│   │   ├── services/      # Services STT, Translation, TTS
│   │   ├── pipeline/      # Pipeline audio et buffering
│   │   ├── core/          # Config, logging, cache
│   │   └── utils/         # Utilitaires (retry, streams)
│   ├── renderer/          # UI React
│   ├── preload/           # Bridge IPC
│   └── shared/            # Types et constantes partagés
├── tests/
│   ├── unit/              # Tests unitaires (Vitest)
│   ├── integration/       # Tests d'intégration
│   └── e2e/               # Tests E2E (Playwright)
├── resources/             # Assets et binaires externes
└── docs/                  # Documentation détaillée
```

### Commandes npm

```bash
# Développement
npm run dev              # Lance app avec hot reload
npm test                 # Tests unitaires
npm run test:e2e         # Tests E2E
npm run lint             # Linting
npm run format           # Formatting

# Build et Packaging
npm run build            # Build production
npm run package          # Package pour OS courant
npm run package:win      # Package Windows
npm run package:mac      # Package macOS
npm run package:linux    # Package Linux
```

### Tests

```bash
# Tests unitaires (Vitest)
npm test

# Tests en mode watch
npm run test:watch

# Couverture de code
npm run test:coverage

# Tests E2E (Playwright)
npm run test:e2e
```

---

## Documentation Technique

Documentation complète disponible dans le dossier du projet :

1. **[architecture.md](./architecture.md)**: Architecture technique complète
   - Choix du framework (Electron vs Tauri)
   - Stack technologique détaillée
   - Comparaison services cloud (STT, Translation, TTS)
   - Patterns de design (Event-Driven, Pipeline, Service Layer)
   - Stratégies d'optimisation (streaming, batching, caching)
   - Considérations de production (monitoring, coûts, rate limiting)

2. **[tech_stack.md](./tech_stack.md)**: Stack technologique et configuration
   - Dépendances complètes (package.json)
   - Configuration TypeScript, Vite, Electron Builder
   - ESLint, Prettier, TailwindCSS
   - Variables d'environnement
   - Exemples d'utilisation des services cloud

3. **[deployment-guide.md](./deployment-guide.md)**: Guide de déploiement
   - Setup environnement de développement
   - Configuration services cloud (Google, DeepL, Azure)
   - Workflow de développement
   - Build et packaging multi-plateforme
   - Distribution (GitHub Releases, App Stores)
   - Troubleshooting et diagnostics

4. **[functional_diagram.mmd](./functional_diagram.mmd)**: Diagrammes fonctionnels
   - Architecture et flux de données
   - Séquence d'exécution temps réel
   - Architecture des composants
   - Gestion du buffering et latence

---

## Roadmap

### Version 1.0 (MVP)

- [x] Pipeline basique Capture → STT → Translation → TTS
- [x] Interface React avec monitoring
- [x] Support Anglais → Français
- [x] Optimisation latence < 2s
- [ ] Tests unitaires et E2E complets
- [ ] Packaging Windows/macOS/Linux
- [ ] Documentation utilisateur

### Version 1.1

- [ ] Support multi-langues (Anglais → Espagnol, Allemand, etc.)
- [ ] Cache intelligent traductions fréquentes
- [ ] Détection automatique langue source
- [ ] Hotkeys clavier (start/stop, volume)
- [ ] Mode offline (traduction locale avec Whisper)

### Version 2.0

- [ ] Sous-titres visuels (overlay sur vidéo)
- [ ] Support Twitch et autres plateformes streaming
- [ ] Historique traductions avec export
- [ ] Mode simultané multi-langues
- [ ] API publique pour intégrations tierces

---

## Contribution

Les contributions sont les bienvenues ! Merci de :

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commiter les changements (`git commit -m 'feat: add amazing feature'`)
4. Push la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

### Guidelines

- Suivre conventions de code (ESLint + Prettier)
- Écrire tests pour nouvelles fonctionnalités
- Mettre à jour documentation si nécessaire
- Respecter Semantic Versioning

---

## Troubleshooting

### Problèmes Courants

**Erreur: "yt-dlp not found"**
```bash
npm run install:deps
```

**Erreur: "Google Cloud credentials not found"**
```bash
# Vérifier chemin dans .env
echo $GOOGLE_APPLICATION_CREDENTIALS
```

**Latence > 2 secondes**
- Vérifier qualité réseau
- Réduire chunk size dans paramètres
- Activer cache traductions

Pour plus de détails, voir [deployment-guide.md](./deployment-guide.md#troubleshooting).

---

## Licence

Ce projet est sous licence MIT. Voir fichier [LICENSE](./LICENSE) pour plus de détails.

---

## Auteurs

- **Votre Nom** - *Travail initial* - [GitHub](https://github.com/your-username)

---

## Remerciements

- **Google Cloud** - Services STT et TTS
- **DeepL** - Service de traduction haute qualité
- **yt-dlp** - Extraction audio YouTube
- **Electron** - Framework desktop cross-platform
- Communauté open-source pour les nombreuses bibliothèques utilisées

---

## Support

- **GitHub Issues**: [Signaler un bug](https://github.com/your-username/youtube-live-translator/issues)
- **Discussions**: [Poser une question](https://github.com/your-username/youtube-live-translator/discussions)
- **Email**: support@yourdomain.com

---

**Built with ❤️ using Electron, React, and TypeScript**
