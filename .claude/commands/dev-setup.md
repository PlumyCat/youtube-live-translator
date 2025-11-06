# Commande : dev-setup

Configure l'environnement de développement complet pour YouTube Live Translator.

## Workflow

### 1. Vérifier Prérequis

```bash
# Node.js 20+
node --version

# npm
npm --version

# Git
git --version
```

Si manquant, afficher instructions d'installation selon OS (Windows/macOS/Linux).

### 2. Installer Dépendances

```bash
# Dépendances npm
npm install

# Binaires externes (yt-dlp, ffmpeg)
npm run install:deps
```

### 3. Configuration Services Cloud

#### Vérifier fichiers de configuration
```bash
# .env doit exister
ls -la .env

# credentials Google Cloud
ls -la credentials/google-cloud-key.json
```

#### Si .env manquant
```bash
cp .env.example .env
nano .env  # Éditer avec vraies clés
```

#### Si credentials Google Cloud manquants
```bash
# Instructions pour créer service account:
# 1. Console Google Cloud : https://console.cloud.google.com
# 2. Create Project "youtube-live-translator"
# 3. Enable APIs : Speech-to-Text, Text-to-Speech, Translation
# 4. Create Service Account
# 5. Download JSON key → credentials/google-cloud-key.json

# Commande gcloud :
gcloud iam service-accounts keys create ./credentials/google-cloud-key.json \
  --iam-account=ytlt-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

#### DeepL API Key
```bash
# 1. Créer compte : https://www.deepl.com/pro-api
# 2. Copier API Key
# 3. Ajouter dans .env :
DEEPL_API_KEY=your_key_here
```

### 4. Tester Configuration

```bash
# Test rapide config
npm run test:config
```

Si erreur, diagnostiquer :
- Clés API invalides
- Credentials path incorrect
- Permissions service account manquantes

### 5. Lancer Dev

```bash
# Mode développement avec hot reload
npm run dev
```

L'application devrait s'ouvrir avec DevTools.

### 6. Vérification Finale

- [ ] Application démarre sans erreur
- [ ] DevTools affichent console sans erreurs
- [ ] Peut entrer URL YouTube dans interface
- [ ] Status "Inactif" visible

## Troubleshooting

### "Cannot find module 'electron'"
```bash
rm -rf node_modules package-lock.json
npm install
```

### "yt-dlp not found"
```bash
npm run install:deps

# Ou manuel :
# Windows: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
# macOS/Linux: https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
# Placer dans resources/binaries/{os}/
```

### "Google Cloud credentials error"
```bash
# Vérifier path
echo $GOOGLE_APPLICATION_CREDENTIALS

# Vérifier fichier existe
cat credentials/google-cloud-key.json | jq .

# Re-créer si nécessaire
gcloud iam service-accounts keys create credentials/google-cloud-key.json \
  --iam-account=SERVICE_ACCOUNT_EMAIL
```

### "Port 5173 already in use"
```bash
# Trouver et tuer process
lsof -i :5173
kill -9 <PID>

# Ou changer port dans electron.vite.config.ts
```

## Configuration VS Code Recommandée

Créer `.vscode/settings.json` :
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Résultat Attendu

- ✅ Application lance en mode dev
- ✅ Hot reload fonctionne
- ✅ DevTools ouverts
- ✅ Pas d'erreurs console
- ✅ Services cloud configurés
- ✅ Tests passent : `npm test`

Prêt pour développement !
