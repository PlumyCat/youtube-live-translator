# Scripts

Ce dossier contient les scripts utilitaires du projet.

## postinstall.js

**Objectif** : Corriger automatiquement le bug npm avec les dépendances optionnelles Rollup sur Windows.

**Problème** : Lorsqu'un projet est développé sur Linux/macOS puis transféré sur Windows, npm échoue à installer les binaires natifs optionnels de Rollup (`@rollup/rollup-win32-x64-msvc`) à cause d'un [bug connu](https://github.com/npm/cli/issues/4828).

**Solution** : Ce script s'exécute automatiquement après `npm install` et :
1. Détecte si la plateforme est Windows x64
2. Vérifie si le binaire Rollup Windows est présent
3. Si absent, télécharge le package depuis le registry npm
4. Extrait et installe le binaire au bon emplacement

**Utilisation** :
```bash
# Automatique après npm install
npm install

# Ou manuel
node scripts/postinstall.js
```

**Log attendu** :
- Si binaire déjà présent : `✓ Rollup Windows binary already installed`
- Si installation nécessaire :
  ```
  ⚙ Installing Rollup Windows native binary...
    → Downloading from https://registry.npmjs.org/...
    ✓ Downloaded successfully
    ✓ Extracted successfully
    ✓ Created @rollup directory
    ✓ Moved to node_modules/@rollup/rollup-win32-x64-msvc
    ✓ Cleaned up temporary files

  ✅ Rollup Windows binary installed successfully!
  ```

**En cas d'erreur** :
Le script affiche un message d'erreur détaillé et renvoie un code de sortie 1. Consultez la section "Troubleshooting" du README.md principal pour la solution manuelle.

## Maintenance

Si la version de Rollup change dans `package.json`, mettre à jour la constante `ROLLUP_VERSION` dans `postinstall.js`.
