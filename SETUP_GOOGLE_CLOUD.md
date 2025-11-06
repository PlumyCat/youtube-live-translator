# Configuration Google Cloud (STT + TTS)

Ce guide explique comment configurer Google Cloud Speech-to-Text et Text-to-Speech pour le projet.

## 📋 Prérequis

1. Compte Google Cloud (gratuit avec $300 de crédits pour débuter)
2. Carte bancaire (pour vérification, mais pas de charge automatique)

## 🚀 Étapes de Configuration

### 1. Créer un Projet Google Cloud

1. Va sur [Google Cloud Console](https://console.cloud.google.com/)
2. Clique sur le sélecteur de projet (en haut à gauche)
3. Clique sur **"Nouveau projet"**
4. Donne un nom à ton projet (ex: `youtube-translator`)
5. Clique sur **"Créer"**

### 2. Activer les APIs Nécessaires

1. Dans la console, va dans **"APIs & Services" > "Bibliothèque"**
2. Cherche et active ces APIs :
   - **Cloud Speech-to-Text API**
   - **Cloud Text-to-Speech API**

Pour chaque API :
- Clique dessus
- Clique sur **"Activer"**

### 3. Créer un Service Account

1. Va dans **"IAM & Admin" > "Service Accounts"**
2. Clique sur **"Créer un compte de service"**
3. Remplis :
   - **Nom** : `youtube-translator-service`
   - **Description** : `Service account for YouTube Live Translator app`
4. Clique sur **"Créer et continuer"**

### 4. Attribuer les Permissions

1. Dans **"Attribuer des rôles au compte de service"** :
   - Ajoute le rôle : **"Cloud Speech Client"**
   - Ajoute le rôle : **"Cloud Text-to-Speech User"**
2. Clique sur **"Continuer"**
3. Clique sur **"Terminé"**

### 5. Créer et Télécharger la Clé JSON

1. Dans la liste des comptes de service, clique sur le compte que tu viens de créer
2. Va dans l'onglet **"Clés"**
3. Clique sur **"Ajouter une clé" > "Créer une clé"**
4. Choisis le format **JSON**
5. Clique sur **"Créer"**

➡️ **Un fichier JSON sera téléchargé automatiquement**

### 6. Placer le Fichier JSON dans le Projet

1. Crée un dossier `credentials` à la racine du projet :
   ```bash
   mkdir credentials
   ```

2. Déplace le fichier JSON téléchargé dans ce dossier :
   ```
   youtube-live-translator/
   ├── credentials/
   │   └── google-cloud-key.json    ← Ton fichier ici
   ├── src/
   ├── package.json
   └── ...
   ```

3. **IMPORTANT** : Renomme le fichier en `google-cloud-key.json` (ou adapte le chemin dans `.env`)

### 7. Configurer le Fichier .env

1. Copie `.env.example` vers `.env` :
   ```bash
   cp .env.example .env
   ```

2. Modifie la ligne dans `.env` :
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=./credentials/google-cloud-key.json
   ```

3. Configure les autres variables si nécessaire :
   ```bash
   STT_LANGUAGE=en-US      # Langue source (anglais US)
   TARGET_LANGUAGE=fr      # Langue cible (français)
   TTS_VOICE_NAME=fr-FR-Neural2-A  # Voix française
   ```

## ✅ Vérification

Pour vérifier que tout fonctionne :

```bash
npm run dev
```

Si tu vois des erreurs d'authentification, vérifie que :
- Le chemin vers le JSON est correct dans `.env`
- Le fichier JSON existe bien dans `credentials/`
- Les APIs sont activées dans Google Cloud Console

## 💰 Coûts Estimés

**Utilisation modérée (2h/jour)** :

| Service | Prix | Usage estimé | Coût mensuel |
|---------|------|--------------|--------------|
| STT (Speech-to-Text) | $0.006/15s | ~240 min/mois | ~$6 |
| TTS (Text-to-Speech) | $16/1M chars | ~500k chars/mois | ~$8 |
| **TOTAL** | | | **~$14/mois** |

**Note** : Google offre $300 de crédits gratuits pour les nouveaux comptes (valables 90 jours).

## 🔒 Sécurité

**IMPORTANT** :
- ❌ **NE JAMAIS** commiter le fichier JSON dans Git
- ✅ Le dossier `credentials/` est déjà dans `.gitignore`
- ✅ Ne partage jamais ce fichier JSON
- ✅ Si compromis, révoque la clé dans Google Cloud Console

## 🐛 Dépannage

### Erreur : "API has not been used in project before"

➡️ Va dans Google Cloud Console et active les APIs (étape 2)

### Erreur : "Permission denied"

➡️ Vérifie que les rôles sont bien attribués au Service Account (étape 4)

### Erreur : "Could not load the default credentials"

➡️ Vérifie le chemin dans `.env` et l'existence du fichier JSON

### Erreur : "Quota exceeded"

➡️ Tu as dépassé les limites gratuites, vérifie ton usage dans la console

## 📚 Documentation Officielle

- [Speech-to-Text Pricing](https://cloud.google.com/speech-to-text/pricing)
- [Text-to-Speech Pricing](https://cloud.google.com/text-to-speech/pricing)
- [Service Accounts Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)

---

**Besoin d'aide ?** Ouvre une issue sur GitHub avec les logs d'erreur (sans exposer tes credentials).
