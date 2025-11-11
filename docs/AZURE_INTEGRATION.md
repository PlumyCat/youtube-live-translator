# Azure Services Integration

Cette documentation décrit l'intégration des services Azure Cognitive Services dans le projet YouTube Live Translator.

## Vue d'ensemble

L'application supporte maintenant **deux ensembles de providers cloud** :

### Stack Google Cloud + DeepL (par défaut)
- **STT** : Google Cloud Speech-to-Text
- **Translation** : DeepL API
- **TTS** : Google Cloud Text-to-Speech

### Stack Azure Cognitive Services (nouveau)
- **STT** : Azure Speech-to-Text
- **Translation** : Azure Translator
- **TTS** : Azure Text-to-Speech

## Configuration

### 1. Obtenir les clés API Azure

#### Azure Speech Services (STT + TTS)
1. Créer une ressource "Speech Services" sur [Azure Portal](https://portal.azure.com)
2. Région recommandée : `westeurope` (faible latence pour l'Europe)
3. Noter : **Key** et **Region**

#### Azure Translator
1. Créer une ressource "Translator" sur [Azure Portal](https://portal.azure.com)
2. Noter : **Key**, **Region**, et **Endpoint**

### 2. Configurer les variables d'environnement

Ajouter dans votre fichier `.env` :

```bash
# Azure Speech Services (STT + TTS)
AZURE_SPEECH_KEY=votre_cle_azure_speech
AZURE_SPEECH_REGION=westeurope

# Azure Translator
AZURE_TRANSLATOR_KEY=votre_cle_azure_translator
AZURE_TRANSLATOR_REGION=westeurope
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com/

# Sélection des providers (changer google/deepl en azure)
STT_PROVIDER=azure
TRANSLATION_PROVIDER=azure
TTS_PROVIDER=azure
```

### 3. Providers mixtes (optionnel)

Vous pouvez mixer les providers selon vos besoins :

```bash
# Exemple : Azure STT + DeepL Translation + Google TTS
STT_PROVIDER=azure
TRANSLATION_PROVIDER=deepl
TTS_PROVIDER=google
```

## Architecture

### Service Factory Pattern

L'application utilise un **factory pattern** pour instancier les bons services selon la configuration :

```typescript
// src/main/services/service-factory.ts
import { createSTTService, createTranslationService, createTTSService } from '@main/services/service-factory';

// Crée automatiquement le bon service selon process.env.STT_PROVIDER
const sttService = createSTTService(config);
const translationService = createTranslationService(config);
const ttsService = createTTSService(config);
```

### Implémentation des services

Chaque service Azure implémente l'interface correspondante :

```
src/main/services/
├── azure-stt-service.ts          # Azure Speech-to-Text
├── azure-translator-service.ts   # Azure Translator
├── azure-tts-service.ts          # Azure Text-to-Speech (avec sélection du genre de voix)
└── service-factory.ts            # Factory pour créer les services
```

## Fonctionnalités

### Azure Speech-to-Text (STT)
- ✅ Transcription temps réel avec SDK Azure Speech
- ✅ Support multi-langues (même que Google)
- ✅ Streaming audio avec push stream
- ✅ Circuit breaker et retry logic
- ✅ Métriques de performance (latence, succès/échecs)

### Azure Translator
- ✅ Traduction via REST API
- ✅ Cache LRU (1000 entrées, TTL 24h)
- ✅ Support multi-langues avec mapping automatique ISO 639-1
- ✅ Circuit breaker et retry avec backoff exponentiel
- ✅ Métriques incluant cache hit ratio

### Azure Text-to-Speech (TTS)
- ✅ Synthèse vocale avec voix neuronales Azure
- ✅ **Sélection du genre de voix** : `male`, `female`, `neutral`
- ✅ Support 10 langues avec voix neuronales premium
- ✅ Format audio MP3 16kHz 32kbps
- ✅ Circuit breaker et métriques

#### Voix disponibles par langue

| Langue | Homme | Femme | Neutre |
|--------|-------|-------|--------|
| Français (fr-FR) | Henri | Denise | Denise |
| Anglais US (en-US) | Guy | Jenny | Aria |
| Anglais UK (en-GB) | Ryan | Sonia | Libby |
| Espagnol (es-ES) | Alvaro | Elvira | Elvira |
| Allemand (de-DE) | Conrad | Katja | Katja |
| Italien (it-IT) | Diego | Elsa | Elsa |
| Portugais BR (pt-BR) | Antonio | Francisca | Francisca |
| Japonais (ja-JP) | Keita | Nanami | Nanami |
| Coréen (ko-KR) | InJoon | SunHi | SunHi |
| Chinois (zh-CN) | Yunxi | Xiaoxiao | Xiaoxiao |

**Configuration du genre de voix** :

Dans la page Settings de l'application, ou via `.env` :

```bash
# Dans le futur, ajout d'une variable d'environnement
VOICE_GENDER=female  # male | female | neutral
```

## Tests

### Test automatique des services Azure

```bash
npm run test:azure
```

Ce script teste :
- ✅ Azure Translator : traduction EN → FR
- ✅ Azure TTS : synthèse vocale avec voix française
- ⚠️ Azure STT : nécessite des données audio (utiliser `npm run test:stt` avec provider=azure)

### Test manuel

1. Configurer les variables d'environnement Azure dans `.env`
2. Lancer l'application : `npm run dev`
3. Dans Settings, vérifier que les providers Azure sont sélectionnés
4. Lancer une traduction sur une vidéo YouTube

## Comparaison Google vs Azure

| Critère | Google Cloud | Azure Cognitive Services |
|---------|--------------|--------------------------|
| **STT Latence** | ~300-400ms | ~300-400ms (similaire) |
| **TTS Latence** | ~500-600ms | ~500-600ms (similaire) |
| **Translation Latence** | ~250-300ms (DeepL) | ~300-350ms |
| **Qualité STT** | Excellente | Excellente |
| **Qualité TTS** | Voix Neural2 premium | Voix Neural premium |
| **Qualité Translation** | Très bonne (DeepL) | Très bonne |
| **Coût STT** | $0.006/min | $0.0024/min ✅ **Moins cher** |
| **Coût TTS** | $0.000016/char | $0.000016/char (identique) |
| **Coût Translation** | €20/1M chars (DeepL) | €10/1M chars ✅ **Moins cher** |
| **Sélection genre voix** | Non | ✅ Oui (male/female/neutral) |

### Estimation budget mensuel (~50h usage)

| Service | Google + DeepL | Azure | Économies |
|---------|----------------|-------|-----------|
| STT | $14.40 | $5.76 | **-60%** |
| Translation | $25-30 (DeepL) | $12-15 | **-50%** |
| TTS | $8.64 | $8.64 | 0% |
| **TOTAL** | **$48-53/mois** | **$26-29/mois** | **-45%** ✅ |

**Conclusion** : Azure est **significativement moins cher** pour STT et Translation, avec une qualité et latence similaires.

## Dépannage

### Erreur "Azure credentials not configured"

Vérifier que toutes les variables d'environnement sont définies dans `.env` :

```bash
# Vérifier
echo $AZURE_SPEECH_KEY
echo $AZURE_TRANSLATOR_KEY
```

### Erreur "Invalid language code"

Azure utilise des codes ISO 639-1 (ex : `en`, `fr`) mais l'app utilise des codes étendus (ex : `en-US`, `fr-FR`).
Le service fait automatiquement le mapping, mais vérifier les logs si problème.

### Latence élevée

- **Vérifier la région** : Choisir `westeurope` pour l'Europe, `eastus` pour l'Amérique du Nord
- **Activer le cache** : `CACHE_ENABLED=true` dans `.env`
- **Ajuster chunk size** : `AUDIO_CHUNK_DURATION=1500` (ms)

## Migration depuis Google + DeepL

### Étape 1 : Obtenir les clés Azure

Créer les ressources Azure Speech et Translator (voir section Configuration)

### Étape 2 : Configurer .env

```bash
# Ajouter les clés Azure
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=westeurope
AZURE_TRANSLATOR_KEY=...
AZURE_TRANSLATOR_REGION=westeurope
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com/

# Changer les providers
STT_PROVIDER=azure
TRANSLATION_PROVIDER=azure
TTS_PROVIDER=azure
```

### Étape 3 : Tester

```bash
npm run test:azure
```

### Étape 4 : Lancer l'application

```bash
npm run dev
```

L'application charge automatiquement les services Azure au démarrage. Vérifier les logs :

```
[AzureSTTService] Azure Speech-to-Text service initialized successfully
[AzureTranslatorService] Azure Translator service initialized successfully
[AzureTTSService] Azure Text-to-Speech service initialized successfully
```

## Ressources

- [Azure Speech Services Documentation](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/)
- [Azure Translator Documentation](https://learn.microsoft.com/en-us/azure/cognitive-services/translator/)
- [Azure Neural Voices Gallery](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support?tabs=tts)
- [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/)

## Support

Pour toute question ou problème :
1. Vérifier les logs de l'application (Console DevTools)
2. Tester avec `npm run test:azure`
3. Vérifier les quotas Azure sur le [Azure Portal](https://portal.azure.com)
4. Consulter la documentation Azure Cognitive Services

---

**Note** : L'intégration Azure est **production-ready** et peut être utilisée comme alternative économique à Google Cloud + DeepL.
