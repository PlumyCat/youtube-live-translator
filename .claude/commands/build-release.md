# Commande : build-release

Build et package l'application pour distribution.

## Workflow de Release

### 1. Pré-Release Checklist

#### Tests
```bash
# Tous les tests doivent passer
npm test
npm run test:e2e
npm run test:coverage

# Vérifier coverage > 80%
```

#### Linting
```bash
npm run lint
npm run format
```

#### Documentation
- [ ] README.md à jour
- [ ] CHANGELOG.md complété
- [ ] .env.example à jour
- [ ] Architecture docs cohérentes

#### Configuration
- [ ] Pas de secrets hardcodés
- [ ] Version bump effectué
- [ ] Git tag créé

### 2. Version Bump

```bash
# Choisir type de version (semver)
# Patch (1.0.0 → 1.0.1) : Bug fixes
npm version patch

# Minor (1.0.0 → 1.1.0) : New features (backward compatible)
npm version minor

# Major (1.0.0 → 2.0.0) : Breaking changes
npm version major

# Cela met à jour package.json et crée git tag automatiquement
```

### 3. Build

#### Clean
```bash
# Nettoyer builds précédents
npm run clean

# Ou manuel
rm -rf dist release
```

#### Install Dependencies
```bash
# Dépendances production seulement
npm ci --production

# Binaires externes
npm run install:deps
```

#### Build Application
```bash
# Build complet (main + renderer + preload)
npm run build

# Vérifier output
ls -la dist/
# Doit contenir :
# - dist/main/
# - dist/renderer/
# - dist/preload/
```

### 4. Package par Plateforme

#### Windows
```bash
# Depuis Windows ou Linux avec Wine
npm run package:win

# Outputs :
# release/X.X.X/YouTube-Live-Translator-X.X.X-win-x64.exe (installer)
# release/X.X.X/YouTube-Live-Translator-X.X.X-win-portable.exe (portable)
```

**Tester** :
```powershell
# Installer et lancer
.\release\X.X.X\YouTube-Live-Translator-X.X.X-win-x64.exe

# Ou portable
.\release\X.X.X\YouTube-Live-Translator-X.X.X-win-portable.exe
```

#### macOS
```bash
# Depuis macOS uniquement
npm run package:mac

# Outputs :
# release/X.X.X/YouTube-Live-Translator-X.X.X-mac-x64.dmg (Intel)
# release/X.X.X/YouTube-Live-Translator-X.X.X-mac-arm64.dmg (Apple Silicon)
# release/X.X.X/YouTube-Live-Translator-X.X.X-mac.zip
```

**Code Signing (requis pour distribution)** :
```bash
# Besoin Apple Developer Account ($99/an)
export APPLE_ID="your-email@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"

npm run package:mac
```

**Tester** :
```bash
# Monter DMG
open release/X.X.X/YouTube-Live-Translator-X.X.X-mac-x64.dmg

# Ou extraire ZIP
unzip release/X.X.X/YouTube-Live-Translator-X.X.X-mac.zip
open YouTube\ Live\ Translator.app
```

#### Linux
```bash
# Depuis Linux
npm run package:linux

# Outputs :
# release/X.X.X/YouTube-Live-Translator-X.X.X.AppImage
# release/X.X.X/YouTube-Live-Translator-X.X.X.deb
# release/X.X.X/YouTube-Live-Translator-X.X.X.rpm
```

**Tester** :
```bash
# AppImage (universel)
chmod +x release/X.X.X/YouTube-Live-Translator-X.X.X.AppImage
./release/X.X.X/YouTube-Live-Translator-X.X.X.AppImage

# Debian/Ubuntu
sudo dpkg -i release/X.X.X/YouTube-Live-Translator-X.X.X.deb

# Fedora/RHEL
sudo rpm -i release/X.X.X/YouTube-Live-Translator-X.X.X.rpm
```

### 5. Tests Post-Build

#### Test Installation
- [ ] Installer sur OS propre (VM ou machine test)
- [ ] Lancer application
- [ ] Tester workflow complet (URL → Translation)
- [ ] Vérifier latency < 2000ms
- [ ] Tester start/stop
- [ ] Vérifier pas d'erreurs

#### Test Auto-Update
```bash
# Si auto-update configuré
# 1. Installer version N
# 2. Publier version N+1 sur GitHub
# 3. Attendre notification update
# 4. Accepter update
# 5. Vérifier nouvelle version installée
```

### 6. GitHub Release

#### Automatique (via GitHub Actions)
```bash
# Push tag déclenche build CI/CD
git push origin v1.0.0

# GitHub Actions va :
# 1. Build pour Win/Mac/Linux
# 2. Créer GitHub Release
# 3. Upload binaires
```

#### Manuel
```bash
# 1. Créer release sur GitHub
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes "$(cat CHANGELOG.md)"

# 2. Upload assets
gh release upload v1.0.0 \
  release/1.0.0/*.exe \
  release/1.0.0/*.dmg \
  release/1.0.0/*.AppImage \
  release/1.0.0/*.deb \
  release/1.0.0/*.rpm
```

### 7. Release Notes

#### Template CHANGELOG.md
```markdown
## [1.0.0] - 2025-11-06

### Added
- Initial release
- Real-time YouTube video translation (EN → FR)
- Latency monitoring (target < 2s)
- Google Cloud STT integration
- DeepL Translation integration
- Google Cloud TTS integration
- Metrics dashboard

### Performance
- Average latency: 1300ms
- Cache hit ratio: 25%
- Success rate: 98%

### Known Issues
- None

### Requirements
- Node.js 20+
- Google Cloud account
- DeepL account
- Windows 10+, macOS 11+, or Linux (Ubuntu 20.04+)
```

### 8. Distribution

#### GitHub Releases (Gratuit)
```bash
# Users download depuis :
https://github.com/username/youtube-live-translator/releases
```

#### Site Web
```html
<!-- Landing page avec download links -->
<div class="downloads">
  <h2>Download</h2>
  <a href="https://github.com/.../YouTube-Live-Translator-1.0.0-win.exe">
    Windows (64-bit)
  </a>
  <a href="https://github.com/.../YouTube-Live-Translator-1.0.0-mac.dmg">
    macOS (Intel)
  </a>
  <a href="https://github.com/.../YouTube-Live-Translator-1.0.0-mac-arm64.dmg">
    macOS (Apple Silicon)
  </a>
  <a href="https://github.com/.../YouTube-Live-Translator-1.0.0.AppImage">
    Linux (AppImage)
  </a>
</div>
```

#### App Stores (Optionnel)
- **Windows Store** : Requires Microsoft Partner Center ($19)
- **Mac App Store** : Requires Apple Developer Account ($99/year)

## Checklist Complète

### Pré-Build
- [ ] Tests passent
- [ ] Linting OK
- [ ] Documentation à jour
- [ ] Version bump
- [ ] Git tag créé
- [ ] Secrets nettoyés

### Build
- [ ] npm run build réussi
- [ ] dist/ contient tous fichiers
- [ ] Binaires externes inclus
- [ ] Taille binaire raisonnable

### Package
- [ ] Windows package OK
- [ ] macOS package OK (si applicable)
- [ ] Linux package OK
- [ ] Code signing OK (macOS)
- [ ] Tailles fichiers :
  - Windows: ~100-150MB
  - macOS: ~100-150MB
  - Linux: ~100-150MB

### Tests Post-Build
- [ ] Installation OK
- [ ] Lancement OK
- [ ] Workflow complet fonctionne
- [ ] Latency < 2000ms
- [ ] Pas d'erreurs console
- [ ] Auto-update fonctionne

### Release
- [ ] GitHub Release créée
- [ ] Binaires uploadés
- [ ] Release notes complètes
- [ ] Tag Git pushed
- [ ] CHANGELOG.md updated
- [ ] Documentation utilisateur disponible

### Post-Release
- [ ] Monitoring activé
- [ ] Feedback users collecté
- [ ] Issues GitHub triées
- [ ] Annonce publiée

## Troubleshooting Build

### "electron-builder error"
```bash
# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install
npm run package
```

### "Code signing failed" (macOS)
```bash
# Vérifier certificats
security find-identity -v -p codesigning

# Si pas de certificat : désactiver temporairement
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run package:mac
```

### "Binary too large"
```bash
# Vérifier taille
du -h release/X.X.X/*

# Optimisations :
# 1. Vérifier node_modules (production only)
# 2. Exclure dev dependencies
# 3. Compresser assets
# 4. Utiliser asar (Electron)
```

### "Missing dependencies"
```bash
# Vérifier extraResources dans electron-builder.json
# S'assurer yt-dlp et ffmpeg inclus :
{
  "extraResources": [
    {
      "from": "resources/binaries/${os}",
      "to": "binaries"
    }
  ]
}
```

## CI/CD (GitHub Actions)

Workflow automatique défini dans `.github/workflows/build.yml` :
- Déclenché sur push de tag `v*`
- Build multi-platform (Win/Mac/Linux)
- Tests automatiques
- GitHub Release auto-créée
- Assets auto-uploadés

Release complète et distribuée avec succès !
