# Stack Technologique - YouTube Live Translator

**Version**: 1.0
**Date**: 2025-11-06
**Complément**: architecture.md

---

## Dépendances Principales

### Package.json Complet

```json
{
  "name": "youtube-live-translator",
  "version": "1.0.0",
  "description": "Real-time YouTube video translation desktop application",
  "main": "dist/main/index.js",
  "author": "Your Name",
  "license": "MIT",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "package": "electron-builder",
    "package:win": "electron-builder --win",
    "package:mac": "electron-builder --mac",
    "package:linux": "electron-builder --linux",
    "test": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx}\""
  },
  "dependencies": {
    "@google-cloud/speech": "^6.3.0",
    "@google-cloud/text-to-speech": "^5.1.0",
    "@google-cloud/translate": "^8.1.0",
    "axios": "^1.6.2",
    "axios-retry": "^4.0.0",
    "deepl-node": "^1.11.0",
    "dotenv": "^16.3.1",
    "electron-updater": "^6.1.7",
    "fluent-ffmpeg": "^2.1.2",
    "pino": "^8.17.2",
    "pino-pretty": "^10.3.1",
    "speaker": "^0.5.4",
    "wav": "^1.0.2",
    "zod": "^3.22.4",
    "zustand": "^4.4.7"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.1",
    "@types/fluent-ffmpeg": "^2.1.24",
    "@types/node": "^20.10.5",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "@types/speaker": "^0.3.3",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "electron-vite": "^2.0.0",
    "eslint": "^8.56.0",
    "eslint-config-prettier": "^9.1.0",
    "postcss": "^8.4.32",
    "prettier": "^3.1.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^3.3.6",
    "typescript": "^5.3.3",
    "vite": "^5.0.8",
    "vitest": "^1.0.4"
  }
}
```

---

## Configuration TypeScript

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "types": ["node", "vite/client"],
    "baseUrl": ".",
    "paths": {
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"],
      "@shared/*": ["src/shared/*"],
      "@preload/*": ["src/preload/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "release"]
}
```

### tsconfig.node.json (pour scripts build)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "types": ["node"]
  },
  "include": ["electron.vite.config.ts"]
}
```

---

## Configuration Vite

### electron.vite.config.ts

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared'),
      },
    },
    build: {
      rollupOptions: {
        external: [
          'speaker',
          'fluent-ffmpeg',
          '@google-cloud/speech',
          '@google-cloud/text-to-speech',
        ],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@preload': resolve('src/preload'),
        '@shared': resolve('src/shared'),
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
    css: {
      postcss: './postcss.config.js',
    },
  },
});
```

---

## Configuration Electron Builder

### electron-builder.json

```json
{
  "appId": "com.ytlivetranslator.app",
  "productName": "YouTube Live Translator",
  "copyright": "Copyright © 2025",
  "directories": {
    "output": "release/${version}",
    "buildResources": "resources"
  },
  "files": [
    "dist/**/*",
    "package.json"
  ],
  "extraResources": [
    {
      "from": "resources/binaries/${os}",
      "to": "binaries",
      "filter": ["**/*"]
    }
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64", "ia32"]
      },
      {
        "target": "portable",
        "arch": ["x64"]
      }
    ],
    "icon": "resources/icon.ico",
    "artifactName": "${productName}-${version}-${os}-${arch}.${ext}"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  },
  "mac": {
    "target": [
      {
        "target": "dmg",
        "arch": ["x64", "arm64"]
      },
      {
        "target": "zip",
        "arch": ["x64", "arm64"]
      }
    ],
    "icon": "resources/icon.icns",
    "category": "public.app-category.utilities",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "resources/entitlements.mac.plist",
    "entitlementsInherit": "resources/entitlements.mac.plist"
  },
  "dmg": {
    "contents": [
      {
        "x": 130,
        "y": 220
      },
      {
        "x": 410,
        "y": 220,
        "type": "link",
        "path": "/Applications"
      }
    ]
  },
  "linux": {
    "target": [
      {
        "target": "AppImage",
        "arch": ["x64"]
      },
      {
        "target": "deb",
        "arch": ["x64"]
      },
      {
        "target": "rpm",
        "arch": ["x64"]
      }
    ],
    "icon": "resources/icon.png",
    "category": "Audio",
    "synopsis": "Real-time YouTube video translation",
    "description": "Desktop application for translating YouTube videos in real-time"
  },
  "publish": {
    "provider": "github",
    "owner": "your-username",
    "repo": "youtube-live-translator"
  }
}
```

---

## Configuration ESLint et Prettier

### .eslintrc.json

```json
{
  "env": {
    "browser": true,
    "es2022": true,
    "node": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": ["@typescript-eslint", "react"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### .prettierrc.json

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

---

## Configuration TailwindCSS

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e3f2fd',
          100: '#bbdefb',
          200: '#90caf9',
          300: '#64b5f6',
          400: '#42a5f5',
          500: '#2196f3',
          600: '#1e88e5',
          700: '#1976d2',
          800: '#1565c0',
          900: '#0d47a1',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
    },
  },
  plugins: [],
};
```

### postcss.config.js

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## Configuration Vitest

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/'],
    },
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
```

---

## Configuration Playwright

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'test-results/html' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'electron',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

---

## Variables d'Environnement

### .env.example

```bash
# =============================================================================
# GOOGLE CLOUD SERVICES
# =============================================================================

# Google Cloud API Key (ou path vers credentials.json)
GOOGLE_CLOUD_API_KEY=your_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=./credentials/google-cloud-key.json

# Project ID Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# =============================================================================
# DEEPL TRANSLATION
# =============================================================================

# DeepL API Key (Free ou Pro)
DEEPL_API_KEY=your_deepl_api_key_here

# =============================================================================
# AZURE SERVICES (Alternative)
# =============================================================================

# Azure Speech Services
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=westeurope

# Azure Translator
AZURE_TRANSLATOR_KEY=your_azure_translator_key
AZURE_TRANSLATOR_REGION=westeurope
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com/

# =============================================================================
# ELEVENLABS (Alternative TTS)
# =============================================================================

ELEVENLABS_API_KEY=your_elevenlabs_api_key

# =============================================================================
# SERVICE PROVIDERS CONFIGURATION
# =============================================================================

# Choix des providers (google | azure | whisper | elevenlabs | deepl)
STT_PROVIDER=google
TRANSLATION_PROVIDER=deepl
TTS_PROVIDER=google

# =============================================================================
# AUDIO CONFIGURATION
# =============================================================================

# Durée des chunks audio en millisecondes (500-5000)
AUDIO_CHUNK_DURATION=1500

# Langue source pour STT
STT_LANGUAGE=en-US

# Taux d'échantillonnage audio (Hz)
AUDIO_SAMPLE_RATE=16000

# =============================================================================
# LATENCY CONFIGURATION
# =============================================================================

# Latence maximale cible (ms)
TARGET_LATENCY=2000

# Seuil d'ajustement automatique (ms)
LATENCY_ADJUSTMENT_THRESHOLD=2500

# Intervalle de monitoring (ms)
MONITORING_INTERVAL=1000

# =============================================================================
# CACHE CONFIGURATION
# =============================================================================

# Activer le cache de traductions
CACHE_ENABLED=true

# TTL du cache en secondes (86400 = 24h)
CACHE_TTL=86400

# Taille maximale du cache LRU
CACHE_MAX_SIZE=1000

# =============================================================================
# LOGGING
# =============================================================================

# Niveau de log (debug | info | warn | error)
LOG_LEVEL=info

# Activer logs détaillés pour APIs
API_LOGGING_ENABLED=true

# =============================================================================
# RATE LIMITING
# =============================================================================

# Nombre max de requêtes STT par minute
STT_RATE_LIMIT_PER_MIN=1000

# Nombre max de requêtes Translation par minute
TRANSLATION_RATE_LIMIT_PER_MIN=500

# Nombre max de requêtes TTS par minute
TTS_RATE_LIMIT_PER_MIN=500

# =============================================================================
# BUDGET TRACKING
# =============================================================================

# Budget mensuel en USD
MONTHLY_BUDGET=100

# Activer alertes budget
BUDGET_ALERTS_ENABLED=true

# Seuil d'alerte (pourcentage du budget)
BUDGET_ALERT_THRESHOLD=80

# =============================================================================
# NETWORK MONITORING
# =============================================================================

# Activer monitoring qualité réseau
NETWORK_MONITORING_ENABLED=true

# Intervalle de ping (ms)
NETWORK_PING_INTERVAL=10000

# =============================================================================
# DEVELOPMENT
# =============================================================================

# Environnement (development | production)
NODE_ENV=development

# Activer DevTools au démarrage
OPEN_DEV_TOOLS=true

# Activer hot reload
HOT_RELOAD=true

# =============================================================================
# AUTO-UPDATE
# =============================================================================

# Activer auto-update
AUTO_UPDATE_ENABLED=true

# Vérifier updates au démarrage
CHECK_UPDATES_ON_STARTUP=true

# Intervalle de vérification updates (heures)
UPDATE_CHECK_INTERVAL_HOURS=6
```

---

## Installation des Binaires Externes

### Script d'Installation (install-deps.sh)

```bash
#!/bin/bash

# Script d'installation des dépendances externes
# Télécharge yt-dlp et ffmpeg pour chaque plateforme

set -e

RESOURCES_DIR="resources/binaries"

echo "Installing external dependencies..."

# Créer structure répertoires
mkdir -p "$RESOURCES_DIR/win"
mkdir -p "$RESOURCES_DIR/mac"
mkdir -p "$RESOURCES_DIR/linux"

# =============================================================================
# WINDOWS
# =============================================================================

echo "Downloading Windows binaries..."

# yt-dlp pour Windows
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe \
  -o "$RESOURCES_DIR/win/yt-dlp.exe"

# ffmpeg pour Windows
curl -L https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip \
  -o /tmp/ffmpeg-win.zip
unzip -j /tmp/ffmpeg-win.zip "*/bin/ffmpeg.exe" -d "$RESOURCES_DIR/win"
rm /tmp/ffmpeg-win.zip

# =============================================================================
# MACOS
# =============================================================================

echo "Downloading macOS binaries..."

# yt-dlp pour macOS
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos \
  -o "$RESOURCES_DIR/mac/yt-dlp"
chmod +x "$RESOURCES_DIR/mac/yt-dlp"

# ffmpeg pour macOS (via Homebrew bottles ou static build)
curl -L https://evermeet.cx/ffmpeg/ffmpeg-6.1.zip \
  -o /tmp/ffmpeg-mac.zip
unzip /tmp/ffmpeg-mac.zip -d "$RESOURCES_DIR/mac"
chmod +x "$RESOURCES_DIR/mac/ffmpeg"
rm /tmp/ffmpeg-mac.zip

# =============================================================================
# LINUX
# =============================================================================

echo "Downloading Linux binaries..."

# yt-dlp pour Linux
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o "$RESOURCES_DIR/linux/yt-dlp"
chmod +x "$RESOURCES_DIR/linux/yt-dlp"

# ffmpeg pour Linux (static build)
curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
  -o /tmp/ffmpeg-linux.tar.xz
tar -xJf /tmp/ffmpeg-linux.tar.xz -C /tmp
mv /tmp/ffmpeg-*-amd64-static/ffmpeg "$RESOURCES_DIR/linux/"
chmod +x "$RESOURCES_DIR/linux/ffmpeg"
rm -rf /tmp/ffmpeg-*
rm /tmp/ffmpeg-linux.tar.xz

echo "External dependencies installed successfully!"
```

### Package.json Script

```json
{
  "scripts": {
    "install:deps": "bash scripts/install-deps.sh",
    "prebuild": "npm run install:deps"
  }
}
```

---

## Configuration GitHub Actions (CI/CD)

### .github/workflows/build.yml

```yaml
name: Build & Release

on:
  push:
    branches:
      - main
    tags:
      - 'v*'
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

  build:
    needs: test
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install external binaries
        run: npm run install:deps

      - name: Build application
        run: npm run build

      - name: Package application
        run: npm run package
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.os }}-build
          path: release/**/

  release:
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            **/*.exe
            **/*.dmg
            **/*.AppImage
            **/*.deb
            **/*.rpm
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Documentation API Services

### Configuration Google Cloud

#### 1. Créer Projet Google Cloud

```bash
# Installer gcloud CLI
curl https://sdk.cloud.google.com | bash

# Login
gcloud auth login

# Créer projet
gcloud projects create youtube-live-translator --name="YouTube Live Translator"

# Définir projet actif
gcloud config set project youtube-live-translator

# Activer APIs
gcloud services enable speech.googleapis.com
gcloud services enable texttospeech.googleapis.com
gcloud services enable translate.googleapis.com

# Créer service account
gcloud iam service-accounts create ytlt-service \
  --display-name="YouTube Live Translator Service Account"

# Générer clé
gcloud iam service-accounts keys create ./credentials/google-cloud-key.json \
  --iam-account=ytlt-service@youtube-live-translator.iam.gserviceaccount.com

# Donner permissions
gcloud projects add-iam-policy-binding youtube-live-translator \
  --member="serviceAccount:ytlt-service@youtube-live-translator.iam.gserviceaccount.com" \
  --role="roles/speech.client"

gcloud projects add-iam-policy-binding youtube-live-translator \
  --member="serviceAccount:ytlt-service@youtube-live-translator.iam.gserviceaccount.com" \
  --role="roles/texttospeech.client"

gcloud projects add-iam-policy-binding youtube-live-translator \
  --member="serviceAccount:ytlt-service@youtube-live-translator.iam.gserviceaccount.com" \
  --role="roles/translate.client"
```

#### 2. Configuration DeepL

1. Créer compte sur https://www.deepl.com/pro-api
2. Choisir plan:
   - **Free**: 500k chars/mois gratuit
   - **Starter**: $5.99/mois + $25 = 500k chars + overages
   - **Advanced**: Custom pricing
3. Copier API Key dans `.env`

#### 3. Configuration Azure (Alternative)

```bash
# Créer ressources Azure
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

# Obtenir clés
az cognitiveservices account keys list \
  --name ytlt-speech \
  --resource-group ytlt-resources

# Créer Translator Service
az cognitiveservices account create \
  --name ytlt-translator \
  --resource-group ytlt-resources \
  --kind TextTranslation \
  --sku S1 \
  --location westeurope

# Obtenir clés
az cognitiveservices account keys list \
  --name ytlt-translator \
  --resource-group ytlt-resources
```

---

## Exemples d'Utilisation des Services

### Exemple Google STT

```typescript
import speech from '@google-cloud/speech';

const client = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const request = {
  config: {
    encoding: 'LINEAR16' as const,
    sampleRateHertz: 16000,
    languageCode: 'en-US',
    enableAutomaticPunctuation: true,
    model: 'latest_short',
    useEnhanced: true,
  },
  interimResults: true,
};

const recognizeStream = client
  .streamingRecognize(request)
  .on('error', console.error)
  .on('data', data => {
    if (data.results[0] && data.results[0].isFinal) {
      const transcript = data.results[0].alternatives[0].transcript;
      console.log('Transcript:', transcript);
    }
  });

// Pipe audio stream
audioInputStream.pipe(recognizeStream);
```

### Exemple DeepL

```typescript
import * as deepl from 'deepl-node';

const translator = new deepl.Translator(process.env.DEEPL_API_KEY!);

// Simple translation
const result = await translator.translateText('Hello world', 'en', 'fr');
console.log(result.text); // "Bonjour le monde"

// Batch translation
const texts = ['Hello', 'How are you?', 'Goodbye'];
const results = await translator.translateText(texts, 'en', 'fr');
results.forEach(r => console.log(r.text));

// Usage monitoring
const usage = await translator.getUsage();
console.log(`Used ${usage.character.count} of ${usage.character.limit} characters`);
```

### Exemple Google TTS

```typescript
import textToSpeech from '@google-cloud/text-to-speech';

const client = new textToSpeech.TextToSpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const request = {
  input: { text: 'Bonjour le monde' },
  voice: {
    languageCode: 'fr-FR',
    name: 'fr-FR-Neural2-A',
    ssmlGender: 'FEMALE' as const,
  },
  audioConfig: {
    audioEncoding: 'LINEAR16' as const,
    sampleRateHertz: 16000,
    speakingRate: 1.1,
  },
};

const [response] = await client.synthesizeSpeech(request);
const audioBuffer = Buffer.from(response.audioContent as Uint8Array);

// Play audio
speaker.write(audioBuffer);
```

---

## Références et Documentation

### Services Cloud

- **Google Cloud Speech-to-Text**: https://cloud.google.com/speech-to-text/docs
- **Google Cloud Text-to-Speech**: https://cloud.google.com/text-to-speech/docs
- **Google Cloud Translation**: https://cloud.google.com/translate/docs
- **DeepL API**: https://www.deepl.com/docs-api
- **Azure Speech Services**: https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/

### Bibliothèques

- **Electron**: https://www.electronjs.org/docs
- **yt-dlp**: https://github.com/yt-dlp/yt-dlp
- **fluent-ffmpeg**: https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
- **node-speaker**: https://github.com/TooTallNate/node-speaker
- **Zustand**: https://github.com/pmndrs/zustand
- **Pino**: https://getpino.io/

### Outils de Développement

- **Vite**: https://vitejs.dev/
- **Vitest**: https://vitest.dev/
- **Playwright**: https://playwright.dev/
- **electron-builder**: https://www.electron.build/

---

**Fin de la stack technologique détaillée**
