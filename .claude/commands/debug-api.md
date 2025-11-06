# Commande : debug-api

Diagnostique problèmes avec APIs externes (STT, Translation, TTS).

## Workflow de Debugging

### 1. Identifier le Service Problématique

#### Consulter logs
```bash
# Logs complets
tail -f ~/.config/youtube-live-translator/logs/app.log

# Filtrer par service
tail -f ~/.config/youtube-live-translator/logs/app.log | grep -E '(STT|Translation|TTS)'

# Filtrer erreurs seulement
tail -f ~/.config/youtube-live-translator/logs/app.log | grep ERROR
```

#### Observer métriques UI
- Status : Où le pipeline bloque ?
- Latency : Quel stage est anormalement long ?
- Erreurs : Message précis ?

### 2. Debug Google Cloud STT

#### Test connexion
```bash
# Test credential
gcloud auth list
gcloud config get-value project

# Test API enabled
gcloud services list --enabled | grep speech
```

#### Test direct API
```typescript
// tests/manual/test-stt.ts
import speech from '@google-cloud/speech';

const client = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

async function testSTT() {
  try {
    const audioBuffer = Buffer.from('test'); // Mock audio
    const [response] = await client.recognize({
      audio: { content: audioBuffer.toString('base64') },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
      },
    });

    console.log('✅ STT API working');
    console.log('Response:', response);
  } catch (error) {
    console.error('❌ STT API failed:', error);
  }
}

testSTT();
```

#### Erreurs Communes

**Error: UNAUTHENTICATED**
```bash
# Solution 1 : Vérifier credentials path
echo $GOOGLE_APPLICATION_CREDENTIALS
ls -la $GOOGLE_APPLICATION_CREDENTIALS

# Solution 2 : Re-créer credentials
gcloud iam service-accounts keys create credentials/google-cloud-key.json \
  --iam-account=YOUR_SERVICE_ACCOUNT
```

**Error: PERMISSION_DENIED**
```bash
# Accorder permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/speech.client"
```

**Error: RESOURCE_EXHAUSTED (Quota exceeded)**
```bash
# Vérifier quotas
gcloud alpha billing quotas list \
  --project=YOUR_PROJECT_ID \
  --service=speech.googleapis.com

# Augmenter si nécessaire (console Google Cloud)
```

**Error: INVALID_ARGUMENT (Audio format)**
```typescript
// Vérifier format audio
const correctConfig = {
  encoding: 'LINEAR16',        // ✅ PCM
  sampleRateHertz: 16000,      // ✅ 16kHz
  audioChannels: 1,            // ✅ Mono
  languageCode: 'en-US',       // ✅ Anglais US
};

// Éviter
const wrongConfig = {
  encoding: 'MP3',             // ❌ Pas supporté streaming
  sampleRateHertz: 44100,      // ❌ Trop élevé
  audioChannels: 2,            // ❌ Stereo inutile
};
```

### 3. Debug DeepL Translation

#### Test connexion
```typescript
// tests/manual/test-deepl.ts
import * as deepl from 'deepl-node';

const translator = new deepl.Translator(process.env.DEEPL_API_KEY);

async function testDeepL() {
  try {
    // Test simple
    const result = await translator.translateText('Hello', 'en', 'fr');
    console.log('✅ DeepL API working');
    console.log('Translation:', result.text);

    // Vérifier usage
    const usage = await translator.getUsage();
    console.log('Usage:', usage.character);
  } catch (error) {
    console.error('❌ DeepL API failed:', error);
  }
}

testDeepL();
```

#### Erreurs Communes

**Error: 403 Forbidden**
```bash
# API key invalide
# Solution : Vérifier key dans .env
echo $DEEPL_API_KEY

# Régénérer key si nécessaire :
# https://www.deepl.com/account/summary
```

**Error: 456 Quota exceeded**
```bash
# Quota mensuel dépassé
# Solutions :
# 1. Attendre fin du mois (Free tier reset)
# 2. Upgrader plan (Starter/Advanced)
# 3. Fallback Google Translate temporairement

# Vérifier usage actuel
curl -X GET https://api.deepl.com/v2/usage \
  -H "Authorization: DeepL-Auth-Key $DEEPL_API_KEY"
```

**Error: 429 Too many requests**
```bash
# Rate limiting
# Solution : Activer rate limiter dans code

const rateLimiter = new RateLimiter(100, 100); // 100 req/sec

await rateLimiter.acquire();
const translation = await translator.translateText(...);
```

**Error: Traduction incorrecte/vide**
```typescript
// Vérifier input
if (!text || text.trim().length === 0) {
  throw new Error('Empty text');
}

// Vérifier langues
const supportedLanguages = await translator.getSourceLanguages();
console.log('Supported:', supportedLanguages);

// Utiliser formality si besoin
const result = await translator.translateText(text, 'en', 'fr', {
  formality: 'default', // ou 'more', 'less'
  preserveFormatting: true,
});
```

### 4. Debug Google Cloud TTS

#### Test connexion
```typescript
// tests/manual/test-tts.ts
import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs';

const client = new textToSpeech.TextToSpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

async function testTTS() {
  try {
    const [response] = await client.synthesizeSpeech({
      input: { text: 'Bonjour' },
      voice: {
        languageCode: 'fr-FR',
        name: 'fr-FR-Neural2-A',
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        sampleRateHertz: 16000,
      },
    });

    fs.writeFileSync('test-output.wav', response.audioContent);
    console.log('✅ TTS API working');
    console.log('Audio saved to test-output.wav');
  } catch (error) {
    console.error('❌ TTS API failed:', error);
  }
}

testTTS();
```

#### Erreurs Communes

**Error: Voice not found**
```bash
# Lister voix disponibles
gcloud text-to-speech voices list \
  --language-code=fr-FR

# Utiliser voix valide
# - fr-FR-Neural2-A (féminine)
# - fr-FR-Neural2-B (masculine)
# - fr-FR-Standard-A (moins cher)
```

**Error: Audio quality issues**
```typescript
// Configuration optimale
const audioConfig = {
  audioEncoding: 'LINEAR16',   // ✅ PCM non-compressé
  sampleRateHertz: 16000,      // ✅ Match STT input
  speakingRate: 1.1,           // ✅ Légèrement rapide
  pitch: 0,                    // ✅ Naturel
  volumeGainDb: 0,             // ✅ Volume normal
};

// Éviter
const badConfig = {
  audioEncoding: 'MP3',        // ❌ Compression loss
  sampleRateHertz: 8000,       // ❌ Qualité dégradée
  speakingRate: 1.5,           // ❌ Trop rapide
};
```

**Error: Synthesis too slow**
```typescript
// Optimisations :
# 1. Cache phrases courantes
const ttsCache = new Map<string, Buffer>();

if (ttsCache.has(text)) {
  return ttsCache.get(text);
}

# 2. Paralléliser synthèses
const audioPromises = texts.map(text => ttsService.synthesize(text));
const audios = await Promise.all(audioPromises);

# 3. Utiliser voix Standard (plus rapide que Neural2)
voice: {
  languageCode: 'fr-FR',
  name: 'fr-FR-Standard-A', // Plus rapide
}
```

### 5. Debug Rate Limiting

#### Identifier rate limiting
```bash
# Logs montreront :
# "Rate limit exceeded"
# "429 Too Many Requests"
# "RESOURCE_EXHAUSTED"
```

#### Activer rate limiter
```typescript
// services/rate-limiter.service.ts
const sttRateLimiter = new RateLimiter(1000, 1000 / 60); // Google : 1000/min
const deeplRateLimiter = new RateLimiter(100, 100);       // DeepL : 100/sec
const ttsRateLimiter = new RateLimiter(500, 500 / 60);   // Google : 500/min

// Wrapper calls
async function transcribeWithLimit(audio: Buffer): Promise<string> {
  await sttRateLimiter.acquire();
  return sttService.transcribe(audio);
}
```

### 6. Debug Budget/Coûts

#### Monitor usage
```typescript
// Budget tracker logs
budgetTracker.recordUsage('stt', duration, 0.0004);
budgetTracker.recordUsage('translation', charCount, 0.00002);
budgetTracker.recordUsage('tts', charCount, 0.000016);

// Vérifier dépenses
const monthlySpend = budgetTracker.getMonthlySpend();
console.log(`Current spend: $${monthlySpend.toFixed(2)}`);
```

#### Alertes
```typescript
eventBus.on('budget:warning', ({ service, percent }) => {
  console.warn(`⚠️ ${service} at ${percent}% of budget`);

  if (percent > 90) {
    // Fallback vers services moins chers
    // ou arrêter temporairement
  }
});
```

## Checklist Debug

### STT
- [ ] Credentials valides
- [ ] API enabled
- [ ] Permissions OK
- [ ] Format audio correct
- [ ] Pas de quota exceeded
- [ ] Latency acceptable

### Translation
- [ ] API key valide
- [ ] Quota disponible
- [ ] Rate limiting activé
- [ ] Cache fonctionne
- [ ] Qualité traduction OK

### TTS
- [ ] Credentials valides
- [ ] Voix existe
- [ ] Config audio optimale
- [ ] Cache activé
- [ ] Latency acceptable

### Général
- [ ] Network OK (ping services)
- [ ] Logs sans erreurs critiques
- [ ] Budget sous seuil
- [ ] Rate limiting respecté

## Tests Automatisés

```bash
# Test santé de tous les services
npm run test:services

# Output attendu :
# ✅ STT: Connected (latency: 350ms)
# ✅ Translation: Connected (latency: 280ms)
# ✅ TTS: Connected (latency: 620ms)
# ✅ All services healthy
```

APIs debuggées et opérationnelles !
