# Guide de Déploiement et Démarrage Rapide

**Version**: 1.0
**Date**: 2025-11-06
**Projet**: YouTube Live Translator

---

## Table des Matières

1. [Démarrage Rapide](#démarrage-rapide)
2. [Configuration Environnement de Développement](#configuration-environnement-de-développement)
3. [Setup Services Cloud](#setup-services-cloud)
4. [Développement](#développement)
5. [Build et Packaging](#build-et-packaging)
6. [Déploiement et Distribution](#déploiement-et-distribution)
7. [Troubleshooting](#troubleshooting)

---

## Démarrage Rapide

### Prérequis

- **Node.js** 20+ et npm
- **Git**
- **Compte Google Cloud** (Free tier acceptable)
- **Compte DeepL** (Free tier acceptable)
- Système d'exploitation: Windows 10+, macOS 11+, ou Linux (Ubuntu 20.04+)

### Installation en 5 minutes

```bash
# 1. Cloner le repository
git clone https://github.com/your-username/youtube-live-translator.git
cd youtube-live-translator

# 2. Installer les dépendances
npm install

# 3. Installer binaires externes (yt-dlp, ffmpeg)
npm run install:deps

# 4. Copier fichier environnement
cp .env.example .env

# 5. Configurer les clés API (voir section Setup Services Cloud)
nano .env  # ou votre éditeur préféré

# 6. Lancer en mode développement
npm run dev
```

L'application devrait s'ouvrir automatiquement avec DevTools.

---

## Configuration Environnement de Développement

### 1. Installation Node.js et npm

#### Windows

```powershell
# Via Chocolatey
choco install nodejs-lts

# Ou télécharger depuis https://nodejs.org/
```

#### macOS

```bash
# Via Homebrew
brew install node@20

# Ou via nvm (recommandé)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

#### Linux (Ubuntu/Debian)

```bash
# Via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Ou via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

### 2. Installation Git

```bash
# Windows (Chocolatey)
choco install git

# macOS
brew install git

# Linux
sudo apt-get install git
```

### 3. Éditeur Recommandé: VS Code

```bash
# Windows
choco install vscode

# macOS
brew install --cask visual-studio-code

# Linux
sudo snap install code --classic
```

#### Extensions VS Code Recommandées

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "orta.vscode-jest",
    "firsttris.vscode-jest-runner",
    "usernamehw.errorlens",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

Créer `.vscode/extensions.json` avec ce contenu.

### 4. Configuration Globale Git

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## Setup Services Cloud

### Option 1: Google Cloud (Recommandé)

#### Étape 1: Créer Projet Google Cloud

1. Aller sur https://console.cloud.google.com/
2. Créer nouveau projet "YouTube Live Translator"
3. Noter le Project ID

#### Étape 2: Activer les APIs

```bash
# Installer gcloud CLI (si pas déjà fait)
# Windows: https://cloud.google.com/sdk/docs/install
# macOS: brew install google-cloud-sdk
# Linux: sudo snap install google-cloud-cli --classic

# Login
gcloud auth login

# Définir projet
gcloud config set project YOUR_PROJECT_ID

# Activer les APIs nécessaires
gcloud services enable speech.googleapis.com
gcloud services enable texttospeech.googleapis.com
gcloud services enable translate.googleapis.com
```

#### Étape 3: Créer Service Account

```bash
# Créer service account
gcloud iam service-accounts create ytlt-service \
  --display-name="YouTube Live Translator Service"

# Créer et télécharger clé JSON
gcloud iam service-accounts keys create ./credentials/google-cloud-key.json \
  --iam-account=ytlt-service@YOUR_PROJECT_ID.iam.gserviceaccount.com

# Accorder permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:ytlt-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/owner"
```

#### Étape 4: Configurer .env

```bash
# Dans .env
GOOGLE_APPLICATION_CREDENTIALS=./credentials/google-cloud-key.json
GOOGLE_CLOUD_PROJECT_ID=YOUR_PROJECT_ID
STT_PROVIDER=google
TTS_PROVIDER=google
```

#### Coûts Google Cloud

**Free Tier (premiers 12 mois)**:
- Speech-to-Text: 60 minutes/mois gratuit
- Text-to-Speech: 1 million chars/mois (Standard), 4 millions chars/mois (WaveNet)
- Translation: 500k chars/mois gratuit

**Après Free Tier**:
- STT: $0.006 / 15 secondes
- TTS (Neural2): $16 / 1M chars
- Translation: $20 / 1M chars

**Budget estimé (3h/jour)**:
- STT: ~$2/mois
- Translation: Variable selon usage DeepL
- TTS: ~$65/mois
**Total**: ~$70/mois

### Option 2: DeepL Translation

#### Étape 1: Créer Compte

1. Aller sur https://www.deepl.com/pro-api
2. S'inscrire (Free ou Pro)
3. Aller dans Account > API Keys
4. Copier votre API Key

#### Étape 2: Configurer .env

```bash
# Dans .env
DEEPL_API_KEY=your_api_key_here
TRANSLATION_PROVIDER=deepl
```

#### Plans DeepL

- **Free**: 500k chars/mois gratuit
- **Starter**: $6.99/mois + overages
- **Advanced**: Custom pricing

### Option 3: Azure (Alternative)

#### Étape 1: Créer Ressources Azure

```bash
# Login Azure
az login

# Créer resource group
az group create --name ytlt-resources --location westeurope

# Créer Speech Service
az cognitiveservices account create \
  --name ytlt-speech \
  --resource-group ytlt-resources \
  --kind SpeechServices \
  --sku S0 \
  --location westeurope

# Obtenir clés Speech
az cognitiveservices account keys list \
  --name ytlt-speech \
  --resource-group ytlt-resources

# Créer Translator
az cognitiveservices account create \
  --name ytlt-translator \
  --resource-group ytlt-resources \
  --kind TextTranslation \
  --sku S1 \
  --location westeurope

# Obtenir clés Translator
az cognitiveservices account keys list \
  --name ytlt-translator \
  --resource-group ytlt-resources
```

#### Étape 2: Configurer .env

```bash
# Dans .env
AZURE_SPEECH_KEY=your_speech_key
AZURE_SPEECH_REGION=westeurope
AZURE_TRANSLATOR_KEY=your_translator_key
AZURE_TRANSLATOR_REGION=westeurope
STT_PROVIDER=azure
TRANSLATION_PROVIDER=azure
TTS_PROVIDER=azure
```

### Vérification Configuration

```bash
# Test rapide de configuration
npm run test:config
```

Créer script dans `scripts/test-config.ts`:

```typescript
import { ConfigManager } from '../src/main/core/config.manager';
import { logger } from '../src/main/core/logger';

async function testConfig() {
  try {
    const config = ConfigManager.getInstance();
    logger.info('Configuration loaded successfully');
    logger.info('STT Provider:', config.get('services').stt.provider);
    logger.info('Translation Provider:', config.get('services').translation.provider);
    logger.info('TTS Provider:', config.get('services').tts.provider);
    console.log('✅ Configuration OK');
  } catch (error) {
    console.error('❌ Configuration Error:', error);
    process.exit(1);
  }
}

testConfig();
```

---

## Développement

### Structure des Commandes npm

```bash
# Développement
npm run dev              # Lance app en mode dev avec hot reload
npm run dev:main         # Lance seulement main process
npm run dev:renderer     # Lance seulement renderer

# Tests
npm test                 # Lance tests unitaires (Vitest)
npm run test:watch       # Mode watch pour tests
npm run test:coverage    # Génère rapport de couverture
npm run test:e2e         # Lance tests E2E (Playwright)

# Linting et Formatting
npm run lint             # Lint tout le code
npm run lint:fix         # Lint et fix automatique
npm run format           # Format code avec Prettier

# Build
npm run build            # Build app pour développement
npm run build:main       # Build main process
npm run build:renderer   # Build renderer process

# Packaging
npm run package          # Package pour OS courant
npm run package:win      # Package pour Windows
npm run package:mac      # Package pour macOS
npm run package:linux    # Package pour Linux

# Utilitaires
npm run clean            # Nettoie dossiers dist et release
npm run install:deps     # Installe binaires externes (yt-dlp, ffmpeg)
```

### Workflow de Développement Typique

#### 1. Créer une branche feature

```bash
git checkout -b feature/new-awesome-feature
```

#### 2. Développer avec hot reload

```bash
npm run dev
```

L'application se recharge automatiquement à chaque modification.

#### 3. Écrire tests

```typescript
// tests/unit/services/translation.test.ts
import { describe, it, expect, vi } from 'vitest';
import { TranslationService } from '@main/services/translation.service';

describe('TranslationService', () => {
  it('should translate text correctly', async () => {
    const service = new TranslationService('mock-api-key');
    const result = await service.translate('Hello', 'en', 'fr');
    expect(result).toBe('Bonjour');
  });
});
```

#### 4. Lancer tests

```bash
npm run test:watch
```

#### 5. Lint et format

```bash
npm run lint:fix
npm run format
```

#### 6. Commit

```bash
git add .
git commit -m "feat: add new awesome feature"
```

#### 7. Push et créer PR

```bash
git push origin feature/new-awesome-feature
# Créer Pull Request sur GitHub
```

### Debugging

#### VS Code Launch Configuration

Créer `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron: Main",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "runtimeArgs": ["--remote-debugging-port=9223", "."],
      "outputCapture": "std"
    },
    {
      "name": "Electron: Renderer",
      "type": "chrome",
      "request": "attach",
      "port": 9223,
      "webRoot": "${workspaceFolder}/src/renderer",
      "timeout": 30000
    }
  ],
  "compounds": [
    {
      "name": "Electron: All",
      "configurations": ["Electron: Main", "Electron: Renderer"]
    }
  ]
}
```

#### Console Logs

```typescript
// Main process
import { logger } from '@main/core/logger';
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');

// Renderer process
console.log('Message in DevTools console');
```

---

## Build et Packaging

### Build de Production

```bash
# Build complet
npm run build

# Vérifie les fichiers générés
ls -la dist/
```

Structure attendue:
```
dist/
├── main/
│   ├── index.js
│   └── ...
├── preload/
│   └── index.js
└── renderer/
    ├── index.html
    ├── assets/
    └── ...
```

### Packaging Multi-Plateforme

#### Windows (depuis Windows ou Linux)

```bash
npm run package:win
```

Génère:
- `release/x.x.x/YouTube-Live-Translator-x.x.x-win-x64.exe` (installer NSIS)
- `release/x.x.x/YouTube-Live-Translator-x.x.x-win-portable.exe` (portable)

#### macOS (depuis macOS uniquement)

```bash
npm run package:mac
```

Génère:
- `release/x.x.x/YouTube-Live-Translator-x.x.x-mac-x64.dmg`
- `release/x.x.x/YouTube-Live-Translator-x.x.x-mac-arm64.dmg` (Apple Silicon)
- `release/x.x.x/YouTube-Live-Translator-x.x.x-mac.zip`

**Note**: Pour signer l'app macOS (requis pour distribution):

```bash
# Besoin d'un Apple Developer Account ($99/an)
export APPLE_ID="your-apple-id@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"

npm run package:mac
```

#### Linux

```bash
npm run package:linux
```

Génère:
- `release/x.x.x/YouTube-Live-Translator-x.x.x.AppImage`
- `release/x.x.x/YouTube-Live-Translator-x.x.x.deb`
- `release/x.x.x/YouTube-Live-Translator-x.x.x.rpm`

### Test du Package

```bash
# Après packaging, tester l'app
# Windows
./release/x.x.x/win-unpacked/YouTube\ Live\ Translator.exe

# macOS
open ./release/x.x.x/mac/YouTube\ Live\ Translator.app

# Linux
./release/x.x.x/linux-unpacked/youtube-live-translator
```

---

## Déploiement et Distribution

### Option 1: GitHub Releases (Gratuit, Recommandé)

#### Setup

1. Créer Personal Access Token sur GitHub:
   - Settings > Developer settings > Personal access tokens > Tokens (classic)
   - Generate new token avec scope `repo`
   - Copier le token

2. Configurer GitHub Actions Secrets:
   - Repository > Settings > Secrets and variables > Actions
   - Ajouter secret `GITHUB_TOKEN` avec le token

#### Créer Release

```bash
# 1. Tag version
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions build automatiquement et crée release
```

Le workflow `.github/workflows/build.yml` va:
1. Build pour Windows, macOS, Linux
2. Créer GitHub Release avec tag
3. Upload les binaires

#### Configuration Auto-Update

Dans `src/main/index.ts`:

```typescript
import { autoUpdater } from 'electron-updater';

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'your-username',
  repo: 'youtube-live-translator',
});

app.whenReady().then(() => {
  // Check for updates after 5 seconds
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);
});
```

### Option 2: Distribution via Site Web

#### Hébergement des Binaires

**Option A: GitHub Releases (gratuit)**
- Téléchargement direct depuis GitHub
- Exemple URL: `https://github.com/username/repo/releases/download/v1.0.0/app-win.exe`

**Option B: Cloud Storage**
- AWS S3 + CloudFront
- Google Cloud Storage
- Azure Blob Storage

Exemple avec AWS S3:

```bash
# Upload vers S3
aws s3 cp release/ s3://your-bucket/releases/ --recursive

# Configurer electron-updater
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://your-cdn.com/releases/',
});
```

#### Landing Page Exemple

```html
<!DOCTYPE html>
<html>
<head>
  <title>YouTube Live Translator</title>
</head>
<body>
  <h1>YouTube Live Translator</h1>
  <p>Real-time translation for YouTube videos</p>

  <h2>Download</h2>
  <ul>
    <li><a href="https://github.com/username/repo/releases/download/v1.0.0/YouTube-Live-Translator-1.0.0-win.exe">
      Windows (64-bit)
    </a></li>
    <li><a href="https://github.com/username/repo/releases/download/v1.0.0/YouTube-Live-Translator-1.0.0-mac.dmg">
      macOS (Intel)
    </a></li>
    <li><a href="https://github.com/username/repo/releases/download/v1.0.0/YouTube-Live-Translator-1.0.0-mac-arm64.dmg">
      macOS (Apple Silicon)
    </a></li>
    <li><a href="https://github.com/username/repo/releases/download/v1.0.0/YouTube-Live-Translator-1.0.0.AppImage">
      Linux (AppImage)
    </a></li>
  </ul>
</body>
</html>
```

### Option 3: App Stores (Optionnel)

#### Windows Store

1. Créer compte Microsoft Partner Center ($19 one-time)
2. Créer appxupload via electron-builder:

```json
{
  "win": {
    "target": ["appx"]
  },
  "appx": {
    "identityName": "YourCompanyName.YouTubeLiveTranslator",
    "publisher": "CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    "publisherDisplayName": "Your Company"
  }
}
```

3. Soumettre via Partner Center

#### Mac App Store

1. Besoin Apple Developer Account ($99/an)
2. Créer App ID et provisioning profiles
3. Build avec target `mas`:

```json
{
  "mac": {
    "target": ["mas"]
  },
  "mas": {
    "entitlements": "build/entitlements.mas.plist",
    "provisioningProfile": "build/embedded.provisionprofile"
  }
}
```

4. Soumettre via Xcode ou Transporter app

### Stratégie de Versioning

Utiliser Semantic Versioning (semver):

```
MAJOR.MINOR.PATCH

Exemples:
1.0.0 - Initial release
1.0.1 - Bug fix
1.1.0 - New feature (backward compatible)
2.0.0 - Breaking change
```

Mise à jour version:

```bash
# Patch (1.0.0 -> 1.0.1)
npm version patch

# Minor (1.0.0 -> 1.1.0)
npm version minor

# Major (1.0.0 -> 2.0.0)
npm version major

# Push tags
git push --tags
```

---

## Troubleshooting

### Problèmes Courants

#### 1. Erreur: "Cannot find module 'electron'"

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

#### 2. Erreur: "yt-dlp not found"

**Solution**:
```bash
npm run install:deps
```

Ou télécharger manuellement:
- Windows: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
- macOS/Linux: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp

Placer dans `resources/binaries/{os}/`

#### 3. Erreur: "Google Cloud credentials not found"

**Solution**:
```bash
# Vérifier chemin dans .env
echo $GOOGLE_APPLICATION_CREDENTIALS

# Vérifier fichier existe
ls -la ./credentials/google-cloud-key.json

# Re-télécharger clé si nécessaire
gcloud iam service-accounts keys create ./credentials/google-cloud-key.json \
  --iam-account=ytlt-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

#### 4. Erreur: "EADDRINUSE: address already in use"

Port déjà utilisé (dev server).

**Solution**:
```bash
# Trouver process
lsof -i :5173  # Port Vite par défaut

# Tuer process
kill -9 <PID>

# Ou changer port dans vite.config.ts
export default defineConfig({
  server: {
    port: 5174
  }
})
```

#### 5. Latence > 2 secondes

**Solutions**:
- Vérifier qualité réseau: `npm run test:network`
- Réduire chunk size dans settings
- Vérifier logs API calls: `npm run logs`
- Activer cache traductions

#### 6. Audio playback issues

**Windows**: Installer Visual C++ Redistributable
```bash
choco install vcredist-all
```

**Linux**: Installer ALSA/PulseAudio
```bash
sudo apt-get install libasound2-dev libpulse-dev
```

**macOS**: Généralement pas de problème

#### 7. Build fails sur macOS (code signing)

**Solution temporaire** (développement uniquement):
```bash
# Désactiver codesign temporairement
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run package:mac
```

**Solution permanente**: Obtenir Apple Developer Account

### Logs de Debug

#### Activer logs verbeux

```bash
# .env
LOG_LEVEL=debug
API_LOGGING_ENABLED=true
```

#### Consulter logs

```bash
# Logs app
tail -f ~/Library/Application\ Support/youtube-live-translator/logs/app.log  # macOS
tail -f ~/.config/youtube-live-translator/logs/app.log  # Linux
type %APPDATA%\youtube-live-translator\logs\app.log  # Windows
```

#### Export métriques

```bash
# Via IPC depuis renderer
window.electronAPI.exportMetrics()
  .then(metrics => console.log(metrics));
```

### Tests de Diagnostic

#### Script de diagnostic complet

Créer `scripts/diagnose.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

async function diagnose() {
  console.log('🔍 Running diagnostics...\n');

  // Check Node version
  console.log('📦 Node version:');
  const { stdout: nodeVersion } = await execAsync('node --version');
  console.log(nodeVersion);

  // Check npm version
  console.log('📦 npm version:');
  const { stdout: npmVersion } = await execAsync('npm --version');
  console.log(npmVersion);

  // Check binaries
  console.log('🔧 Checking external binaries:');
  try {
    await fs.access('resources/binaries/yt-dlp');
    console.log('✅ yt-dlp found');
  } catch {
    console.log('❌ yt-dlp NOT found');
  }

  try {
    await fs.access('resources/binaries/ffmpeg');
    console.log('✅ ffmpeg found');
  } catch {
    console.log('❌ ffmpeg NOT found');
  }

  // Check credentials
  console.log('\n🔑 Checking credentials:');
  try {
    await fs.access('./credentials/google-cloud-key.json');
    console.log('✅ Google Cloud credentials found');
  } catch {
    console.log('❌ Google Cloud credentials NOT found');
  }

  // Check .env
  console.log('\n⚙️  Checking .env:');
  try {
    await fs.access('.env');
    console.log('✅ .env file found');
  } catch {
    console.log('❌ .env file NOT found');
  }

  // Test network
  console.log('\n🌐 Testing network:');
  try {
    await execAsync('ping -c 1 8.8.8.8');
    console.log('✅ Internet connection OK');
  } catch {
    console.log('❌ No internet connection');
  }

  console.log('\n✅ Diagnostics complete');
}

diagnose();
```

Lancer:
```bash
npm run diagnose
```

---

## Checklist de Déploiement

### Avant Release

- [ ] Tests unitaires passent (`npm test`)
- [ ] Tests E2E passent (`npm run test:e2e`)
- [ ] Linting OK (`npm run lint`)
- [ ] Pas de secrets hardcodés dans le code
- [ ] `.env.example` à jour avec nouvelles variables
- [ ] Documentation à jour (README.md, CHANGELOG.md)
- [ ] Version bump (`npm version`)
- [ ] Build local réussi (`npm run build`)
- [ ] Package local testé (`npm run package`)
- [ ] Testé sur Windows/macOS/Linux
- [ ] Latence < 2s validée
- [ ] Budget API monitoring activé
- [ ] Auto-update configuré

### Release

- [ ] Tag Git créé (`git tag vX.X.X`)
- [ ] Tag pushed (`git push --tags`)
- [ ] GitHub Actions build réussi
- [ ] GitHub Release créée automatiquement
- [ ] Binaires téléchargés et testés
- [ ] Release notes publiées
- [ ] Documentation utilisateur à jour
- [ ] Annonce sur channels appropriés

### Post-Release

- [ ] Monitoring logs production activé
- [ ] Alertes budget configurées
- [ ] Métriques latence surveillées
- [ ] Feedback utilisateurs collecté
- [ ] Issues GitHub triées

---

## Ressources et Support

### Documentation

- **README.md**: Vue d'ensemble et installation
- **architecture.md**: Architecture technique complète
- **tech_stack.md**: Stack technologique détaillée
- **deployment-guide.md**: Ce document

### Support

- **GitHub Issues**: https://github.com/your-username/youtube-live-translator/issues
- **Discussions**: https://github.com/your-username/youtube-live-translator/discussions
- **Email**: support@yourdomain.com

### Contribution

Voir `CONTRIBUTING.md` pour guidelines de contribution.

---

**Fin du guide de déploiement**
