import { useState, useEffect } from 'react';
import type { PartialServiceConfig, STTProvider, TranslationProvider, TTSProvider, VoiceGender } from '@shared/types';

interface ServiceConfig {
  // Provider selection
  sttProvider: STTProvider;
  translationProvider: TranslationProvider;
  ttsProvider: TTSProvider;

  // Azure credentials
  azureSpeechKey: string;
  azureSpeechRegion: string;
  azureTranslatorKey: string;
  azureTranslatorRegion: string;
  azureTranslatorEndpoint: string;

  // Google Cloud credentials
  googleCloudProjectId: string;
  googleCloudKeyPath: string;

  // DeepL credentials
  deeplApiKey: string;

  // Voice settings
  voiceGender: VoiceGender;
}

// Helper to convert between formats
function toServiceConfig(config: PartialServiceConfig): ServiceConfig {
  return {
    sttProvider: config.providers?.stt || 'azure',
    translationProvider: config.providers?.translation || 'azure',
    ttsProvider: config.providers?.tts || 'azure',
    azureSpeechKey: config.azure?.speechKey || '',
    azureSpeechRegion: config.azure?.speechRegion || 'westeurope',
    azureTranslatorKey: config.azure?.translatorKey || '',
    azureTranslatorRegion: config.azure?.translatorRegion || 'westeurope',
    azureTranslatorEndpoint: config.azure?.translatorEndpoint || 'https://api.cognitive.microsofttranslator.com/',
    googleCloudProjectId: config.googleCloud?.projectId || '',
    googleCloudKeyPath: config.googleCloud?.keyFilePath || '',
    deeplApiKey: config.deepl?.apiKey || '',
    voiceGender: config.voice?.gender || 'female',
  };
}

function toPartialServiceConfig(config: ServiceConfig): PartialServiceConfig {
  return {
    providers: {
      stt: config.sttProvider,
      translation: config.translationProvider,
      tts: config.ttsProvider,
    },
    azure: {
      speechKey: config.azureSpeechKey,
      speechRegion: config.azureSpeechRegion,
      translatorKey: config.azureTranslatorKey,
      translatorRegion: config.azureTranslatorRegion,
      translatorEndpoint: config.azureTranslatorEndpoint,
    },
    googleCloud: {
      projectId: config.googleCloudProjectId,
      keyFilePath: config.googleCloudKeyPath,
    },
    deepl: {
      apiKey: config.deeplApiKey,
    },
    voice: {
      gender: config.voiceGender,
    },
  };
}

interface SettingsPageProps {
  onBack?: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps = {}) {
  const [config, setConfig] = useState<ServiceConfig>({
    sttProvider: 'azure',
    translationProvider: 'azure',
    ttsProvider: 'azure',
    azureSpeechKey: '',
    azureSpeechRegion: 'westeurope',
    azureTranslatorKey: '',
    azureTranslatorRegion: 'westeurope',
    azureTranslatorEndpoint: 'https://api.cognitive.microsofttranslator.com/',
    googleCloudProjectId: '',
    googleCloudKeyPath: '',
    deeplApiKey: '',
    voiceGender: 'female',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'providers' | 'azure' | 'google'>('providers');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const loadedConfig = await window.electronAPI.getServiceConfig();
      setConfig(toServiceConfig(loadedConfig));
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      await window.electronAPI.saveServiceConfig(toPartialServiceConfig(config));
      setSaveMessage('✅ Configuration sauvegardée avec succès!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('❌ Erreur: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setSaveMessage('⏳ Test de connexion en cours...');
    try {
      const result = await window.electronAPI.testConnection();
      setSaveMessage(result.message);
      setTimeout(() => setSaveMessage(''), 5000);
    } catch (error) {
      setSaveMessage('❌ Erreur lors du test: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Calculate estimated cost based on selected providers
  const getEstimatedCost = () => {
    const sttCost = config.sttProvider === 'azure' ? 5.76 : 14.40;
    const translationCost = config.translationProvider === 'azure' ? 12 : (config.translationProvider === 'deepl' ? 25 : 15);
    const ttsCost = 8.64; // Same for both
    return {
      stt: sttCost,
      translation: translationCost,
      tts: ttsCost,
      total: sttCost + translationCost + ttsCost,
    };
  };

  const costs = getEstimatedCost();

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4 mb-2">
          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-sm flex items-center gap-2"
            >
              ← Retour
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-primary-400">Paramètres</h1>
            <p className="text-sm text-gray-400">
              Configuration des services cloud (Azure / Google Cloud / DeepL)
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Cost Estimator Banner */}
          <div className="p-4 bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-green-400 mb-1">💰 Estimation mensuelle (50h d'usage)</h3>
                <p className="text-xs text-gray-300">
                  STT: ${costs.stt.toFixed(2)} • Translation: ${costs.translation.toFixed(2)} • TTS: ${costs.tts.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-400">${costs.total.toFixed(2)}/mois</div>
                <div className="text-xs text-gray-400">
                  {config.sttProvider === 'azure' && config.translationProvider === 'azure'
                    ? '⚡ Configuration optimale (Azure)'
                    : '💵 Config mixte'}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('providers')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'providers'
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              🎯 Sélection des providers
            </button>
            <button
              onClick={() => setActiveTab('azure')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'azure'
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              ☁️ Azure (Recommandé)
            </button>
            <button
              onClick={() => setActiveTab('google')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'google'
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              🔵 Google Cloud / DeepL
            </button>
          </div>

          {/* Providers Tab */}
          {activeTab === 'providers' && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="p-4 bg-blue-900/20 border border-blue-500 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-400 mb-2">ℹ️ Configuration recommandée</h3>
                <p className="text-sm text-gray-300 mb-2">
                  <strong>Azure Cognitive Services</strong> est recommandé pour tous les services car :
                </p>
                <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                  <li><strong>45% moins cher</strong> que Google + DeepL ($26-29/mois vs $48-53/mois)</li>
                  <li><strong>Qualité équivalente</strong> pour STT, Translation et TTS</li>
                  <li><strong>Sélection du genre de voix</strong> (homme/femme/neutre) pour TTS</li>
                  <li><strong>Latence similaire</strong> (~300-600ms selon le service)</li>
                </ul>
              </div>

              {/* STT Provider */}
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">🎤 Speech-to-Text (STT)</h2>
                  <p className="text-sm text-gray-400">Service de transcription audio → texte</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, sttProvider: 'azure' }))}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      config.sttProvider === 'azure'
                        ? 'border-primary-500 bg-primary-900/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">Azure Speech</span>
                      <span className="text-xs bg-green-600 px-2 py-1 rounded">-60% 💰</span>
                    </div>
                    <div className="text-xs text-gray-400">$5.76/mois (50h)</div>
                    {config.sttProvider === 'azure' && (
                      <div className="mt-2 text-xs text-primary-400">✓ Sélectionné</div>
                    )}
                  </button>

                  <button
                    onClick={() => setConfig(prev => ({ ...prev, sttProvider: 'google' }))}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      config.sttProvider === 'google'
                        ? 'border-primary-500 bg-primary-900/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">Google Cloud</span>
                    </div>
                    <div className="text-xs text-gray-400">$14.40/mois (50h)</div>
                    {config.sttProvider === 'google' && (
                      <div className="mt-2 text-xs text-primary-400">✓ Sélectionné</div>
                    )}
                  </button>
                </div>
              </div>

              {/* Translation Provider */}
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">🌐 Translation</h2>
                  <p className="text-sm text-gray-400">Service de traduction multilingue</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, translationProvider: 'azure' }))}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      config.translationProvider === 'azure'
                        ? 'border-primary-500 bg-primary-900/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">Azure</span>
                      <span className="text-xs bg-green-600 px-2 py-1 rounded">-50% 💰</span>
                    </div>
                    <div className="text-xs text-gray-400">$12-15/mois</div>
                    {config.translationProvider === 'azure' && (
                      <div className="mt-2 text-xs text-primary-400">✓ Sélectionné</div>
                    )}
                  </button>

                  <button
                    onClick={() => setConfig(prev => ({ ...prev, translationProvider: 'deepl' }))}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      config.translationProvider === 'deepl'
                        ? 'border-primary-500 bg-primary-900/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">DeepL</span>
                    </div>
                    <div className="text-xs text-gray-400">$25-30/mois</div>
                    {config.translationProvider === 'deepl' && (
                      <div className="mt-2 text-xs text-primary-400">✓ Sélectionné</div>
                    )}
                  </button>

                  <button
                    onClick={() => setConfig(prev => ({ ...prev, translationProvider: 'google' }))}
                    className={`p-4 rounded-lg border-2 transition-all opacity-50 cursor-not-allowed`}
                    disabled
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">Google</span>
                    </div>
                    <div className="text-xs text-gray-400">Bientôt</div>
                  </button>
                </div>
              </div>

              {/* TTS Provider */}
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">🔊 Text-to-Speech (TTS)</h2>
                  <p className="text-sm text-gray-400">Service de synthèse vocale texte → audio</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, ttsProvider: 'azure' }))}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      config.ttsProvider === 'azure'
                        ? 'border-primary-500 bg-primary-900/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">Azure Speech</span>
                      <span className="text-xs bg-blue-600 px-2 py-1 rounded">Genre voix 🎤</span>
                    </div>
                    <div className="text-xs text-gray-400">$8.64/mois • 10 langues</div>
                    {config.ttsProvider === 'azure' && (
                      <div className="mt-2 text-xs text-primary-400">✓ Sélectionné</div>
                    )}
                  </button>

                  <button
                    onClick={() => setConfig(prev => ({ ...prev, ttsProvider: 'google' }))}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      config.ttsProvider === 'google'
                        ? 'border-primary-500 bg-primary-900/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">Google Cloud</span>
                    </div>
                    <div className="text-xs text-gray-400">$8.64/mois • Neural2</div>
                    {config.ttsProvider === 'google' && (
                      <div className="mt-2 text-xs text-primary-400">✓ Sélectionné</div>
                    )}
                  </button>
                </div>
              </div>

              {/* Voice Gender Selection (only for Azure TTS) */}
              {config.ttsProvider === 'azure' && (
                <div className="p-6 bg-gray-800 border border-primary-700 rounded-lg space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-1">🎤 Genre de voix (Azure TTS)</h2>
                    <p className="text-sm text-gray-400">Choisissez le genre de la voix synthétisée</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {(['male', 'female', 'neutral'] as const).map((gender) => (
                      <button
                        key={gender}
                        onClick={() => setConfig(prev => ({ ...prev, voiceGender: gender }))}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          config.voiceGender === gender
                            ? 'border-primary-500 bg-primary-900/20'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="text-2xl mb-2">
                          {gender === 'male' ? '👨' : gender === 'female' ? '👩' : '🧑'}
                        </div>
                        <div className="font-semibold capitalize">{
                          gender === 'male' ? 'Homme' : gender === 'female' ? 'Femme' : 'Neutre'
                        }</div>
                        {config.voiceGender === gender && (
                          <div className="mt-2 text-xs text-primary-400">✓ Sélectionné</div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="text-xs text-gray-400">
                    <strong>Exemples de voix :</strong>
                    {config.voiceGender === 'male' && ' Français: Henri, English: Guy, Español: Alvaro'}
                    {config.voiceGender === 'female' && ' Français: Denise, English: Jenny, Español: Elvira'}
                    {config.voiceGender === 'neutral' && ' Voix neutre disponible pour la plupart des langues'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Azure Tab */}
          {activeTab === 'azure' && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="p-4 bg-blue-900/20 border border-blue-500 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-400 mb-2">☁️ Azure Cognitive Services</h3>
                <p className="text-sm text-gray-300 mb-2">
                  Configuration des clés API Azure. Vous aurez besoin de :
                </p>
                <ul className="text-sm text-gray-300 list-disc list-inside space-y-1 mb-3">
                  <li><strong>Azure Speech Services :</strong> Pour STT (transcription) et TTS (synthèse vocale)</li>
                  <li><strong>Azure Translator :</strong> Pour la traduction multilingue</li>
                </ul>
                <a
                  href="https://portal.azure.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 underline"
                >
                  🔗 Créer les ressources sur Azure Portal
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              {/* Azure Speech Services */}
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">🎙️</div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Azure Speech Services</h2>
                    <p className="text-sm text-gray-400">Pour STT (Speech-to-Text) et TTS (Text-to-Speech)</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="azure-speech-key" className="block text-sm font-medium">
                    Clé API (Key) *
                  </label>
                  <input
                    id="azure-speech-key"
                    type="password"
                    value={config.azureSpeechKey}
                    onChange={e => setConfig(prev => ({ ...prev, azureSpeechKey: e.target.value }))}
                    placeholder="votre_cle_azure_speech_ici"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="azure-speech-region" className="block text-sm font-medium">
                    Région *
                  </label>
                  <select
                    id="azure-speech-region"
                    value={config.azureSpeechRegion}
                    onChange={e => setConfig(prev => ({ ...prev, azureSpeechRegion: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="westeurope">West Europe (Amsterdam) - Recommandé Europe</option>
                    <option value="francecentral">France Central (Paris)</option>
                    <option value="eastus">East US - Recommandé USA</option>
                    <option value="westus">West US</option>
                    <option value="southeastasia">Southeast Asia</option>
                    <option value="japaneast">Japan East</option>
                  </select>
                  <p className="text-xs text-gray-500">
                    Choisir la région la plus proche pour minimiser la latence
                  </p>
                </div>

                <div className="p-3 bg-yellow-900/20 border border-yellow-500 rounded text-xs text-yellow-400">
                  <strong>💡 Comment obtenir :</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Créez une ressource "Speech Services" sur <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="underline">Azure Portal</a></li>
                    <li>Copiez la Key et la Region depuis "Keys and Endpoint"</li>
                  </ol>
                </div>
              </div>

              {/* Azure Translator */}
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">🌍</div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Azure Translator</h2>
                    <p className="text-sm text-gray-400">Service de traduction multilingue</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="azure-translator-key" className="block text-sm font-medium">
                    Clé API (Key) *
                  </label>
                  <input
                    id="azure-translator-key"
                    type="password"
                    value={config.azureTranslatorKey}
                    onChange={e => setConfig(prev => ({ ...prev, azureTranslatorKey: e.target.value }))}
                    placeholder="votre_cle_azure_translator_ici"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="azure-translator-region" className="block text-sm font-medium">
                    Région *
                  </label>
                  <select
                    id="azure-translator-region"
                    value={config.azureTranslatorRegion}
                    onChange={e => setConfig(prev => ({ ...prev, azureTranslatorRegion: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="westeurope">West Europe</option>
                    <option value="eastus">East US</option>
                    <option value="global">Global (multi-region)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="azure-translator-endpoint" className="block text-sm font-medium">
                    Endpoint
                  </label>
                  <input
                    id="azure-translator-endpoint"
                    type="text"
                    value={config.azureTranslatorEndpoint}
                    onChange={e => setConfig(prev => ({ ...prev, azureTranslatorEndpoint: e.target.value }))}
                    placeholder="https://api.cognitive.microsofttranslator.com/"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-500">
                    Généralement : https://api.cognitive.microsofttranslator.com/
                  </p>
                </div>

                <div className="p-3 bg-yellow-900/20 border border-yellow-500 rounded text-xs text-yellow-400">
                  <strong>💡 Comment obtenir :</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Créez une ressource "Translator" sur <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="underline">Azure Portal</a></li>
                    <li>Copiez la Key, Region et Endpoint depuis "Keys and Endpoint"</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Google Tab */}
          {activeTab === 'google' && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="p-4 bg-blue-900/20 border border-blue-500 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-400 mb-2">🔵 Google Cloud + DeepL</h3>
                <p className="text-sm text-gray-300 mb-2">
                  Configuration alternative avec Google Cloud et DeepL. Plus coûteux qu'Azure mais qualité similaire.
                </p>
              </div>

              {/* Google Cloud Configuration */}
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">☁️</div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Google Cloud</h2>
                    <p className="text-sm text-gray-400">Configuration pour STT et TTS</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="google-project-id" className="block text-sm font-medium">
                    Project ID *
                  </label>
                  <input
                    id="google-project-id"
                    type="text"
                    value={config.googleCloudProjectId}
                    onChange={e => setConfig(prev => ({ ...prev, googleCloudProjectId: e.target.value }))}
                    placeholder="my-project-id"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="google-key-path" className="block text-sm font-medium">
                    Chemin vers le fichier de clés JSON *
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="google-key-path"
                      type="text"
                      value={config.googleCloudKeyPath}
                      onChange={e => setConfig(prev => ({ ...prev, googleCloudKeyPath: e.target.value }))}
                      placeholder="C:\keys\google-cloud-key.json"
                      className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={async () => {
                        const filePath = await window.electronAPI.selectKeyFile();
                        if (filePath) {
                          setConfig(prev => ({ ...prev, googleCloudKeyPath: filePath }));
                        }
                      }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Parcourir
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-yellow-900/20 border border-yellow-500 rounded text-xs text-yellow-400">
                  <strong>💡 Comment obtenir :</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Créez un projet sur <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                    <li>Activez les APIs "Speech-to-Text" et "Text-to-Speech"</li>
                    <li>Créez un Service Account et téléchargez le fichier JSON</li>
                  </ol>
                </div>
              </div>

              {/* DeepL Configuration */}
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">🔤</div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">DeepL</h2>
                    <p className="text-sm text-gray-400">Service de traduction haute qualité</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="deepl-api-key" className="block text-sm font-medium">
                    Clé API DeepL *
                  </label>
                  <input
                    id="deepl-api-key"
                    type="password"
                    value={config.deeplApiKey}
                    onChange={e => setConfig(prev => ({ ...prev, deeplApiKey: e.target.value }))}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="p-3 bg-yellow-900/20 border border-yellow-500 rounded text-xs text-yellow-400">
                  <strong>💡 Comment obtenir :</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Créez un compte sur <a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener noreferrer" className="underline">DeepL API</a></li>
                    <li>Choisissez un plan (gratuit: 500K chars/mois)</li>
                    <li>Copiez votre clé API depuis le dashboard</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 sticky bottom-0 bg-gray-900 py-4 border-t border-gray-700">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-lg"
            >
              {isSaving ? '💾 Sauvegarde...' : '💾 Sauvegarder la configuration'}
            </button>

            <button
              onClick={handleTestConnection}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors shadow-lg"
            >
              🔍 Tester la connexion
            </button>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div className={`p-4 rounded-lg shadow-lg ${
              saveMessage.includes('✅')
                ? 'bg-green-900/20 border border-green-500 text-green-400'
                : saveMessage.includes('⏳')
                ? 'bg-blue-900/20 border border-blue-500 text-blue-400'
                : 'bg-red-900/20 border border-red-500 text-red-400'
            }`}>
              {saveMessage}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
