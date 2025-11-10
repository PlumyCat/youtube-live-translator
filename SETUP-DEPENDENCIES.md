# Dépendances Externes - YouTube Live Translator

Ce document explique comment installer les dépendances système nécessaires pour le mode batch.

## 📦 Dépendances Requises

### 1. **yt-dlp** (Téléchargement YouTube)

#### Installation Automatique (Recommandé)

Le projet télécharge automatiquement yt-dlp dans `bin/yt-dlp.exe` en développement.

Si le fichier n'existe pas, exécutez :

```bash
# Windows
curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -o bin/yt-dlp.exe

# Linux/Mac
curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" -o bin/yt-dlp
chmod +x bin/yt-dlp
```

#### Installation Système (Alternative)

**Windows avec Chocolatey :**
```bash
choco install yt-dlp -y
```

**Linux/Mac :**
```bash
# Avec pip
pip install -U yt-dlp

# Ou avec package manager
# Ubuntu/Debian
sudo apt install yt-dlp

# macOS
brew install yt-dlp
```

### 2. **ffmpeg** (Traitement Audio)

#### Windows avec Chocolatey
```bash
choco install ffmpeg -y
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# Fedora
sudo dnf install ffmpeg
```

#### macOS
```bash
brew install ffmpeg
```

## ✅ Vérification

Vérifiez que les dépendances sont installées :

```bash
# yt-dlp
yt-dlp --version

# ffmpeg
ffmpeg -version
```

## 🔧 Configuration Développement vs Production

### Développement
- **yt-dlp** : Utilise `bin/yt-dlp.exe` (téléchargé localement)
- **ffmpeg** : Doit être dans le PATH système

### Production
- Les deux doivent être soit :
  - Bundlés avec l'application dans le package Electron
  - Installés sur le système cible
  - Disponibles dans le PATH

## 🐛 Résolution de Problèmes

### Erreur : `spawn yt-dlp ENOENT`

**Cause** : yt-dlp n'est pas trouvé

**Solution** :
1. Vérifiez que `bin/yt-dlp.exe` existe
2. Ou installez yt-dlp sur le système
3. Redémarrez l'application

### Erreur : `spawn ffmpeg ENOENT`

**Cause** : ffmpeg n'est pas installé ou pas dans le PATH

**Solution** :
```bash
# Windows (Chocolatey)
choco install ffmpeg -y

# Puis redémarrez le terminal pour recharger le PATH
```

### Permissions refusées (Windows)

Si l'installation Chocolatey échoue avec "Accès refusé" :

1. Ouvrez PowerShell/CMD **en tant qu'administrateur**
2. Réexécutez la commande d'installation

## 📝 Notes

- **Développement** : Le dossier `bin/` est dans `.gitignore` (binaires non versionnés)
- **Production** : Voir `deployment-guide.md` pour le packaging des binaires
- **Mises à jour** : Pour mettre à jour yt-dlp, supprimez `bin/yt-dlp.exe` et re-téléchargez

## 🔗 Liens Utiles

- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [ffmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Chocolatey](https://chocolatey.org/)
