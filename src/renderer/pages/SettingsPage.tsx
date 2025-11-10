import { useState, useEffect } from 'react';
import type { PartialServiceConfig } from '@shared/types';

interface ServiceConfig {
  googleCloudProjectId: string;
  googleCloudKeyPath: string;
  deeplApiKey: string;
}

// Helper to convert between formats
function toServiceConfig(config: PartialServiceConfig): ServiceConfig {
  return {
    googleCloudProjectId: config.googleCloud?.projectId || '',
    googleCloudKeyPath: config.googleCloud?.keyFilePath || '',
    deeplApiKey: config.deepl?.apiKey || '',
  };
}

function toPartialServiceConfig(config: ServiceConfig): PartialServiceConfig {
  return {
    googleCloud: {
      projectId: config.googleCloudProjectId,
      keyFilePath: config.googleCloudKeyPath,
    },
    deepl: {
      apiKey: config.deeplApiKey,
    },
  };
}

interface SettingsPageProps {
  onBack?: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps = {}) {
  const [config, setConfig] = useState<ServiceConfig>({
    googleCloudProjectId: '',
    googleCloudKeyPath: '',
    deeplApiKey: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    // Load current configuration
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
      setSaveMessage('Configuration sauvegardée avec succès!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Erreur lors de la sauvegarde: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setSaveMessage('Test de connexion en cours...');
    try {
      const result = await window.electronAPI.testConnection();
      setSaveMessage(result.message);
      setTimeout(() => setSaveMessage(''), 5000);
    } catch (error) {
      setSaveMessage('Erreur lors du test: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

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
              Configuration des services cloud (Google Cloud, DeepL)
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Info Banner */}
          <div className="p-4 bg-blue-900/20 border border-blue-500 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">ℹ️ Information</h3>
            <p className="text-sm text-gray-300 mb-2">
              Cette application nécessite des clés API pour fonctionner. Vous devez créer des comptes
              et obtenir des clés pour les services suivants:
            </p>
            <ul className="text-sm text-gray-300 list-disc list-inside space-y-1 mb-3">
              <li><strong>Google Cloud:</strong> Pour la transcription (STT) et synthèse vocale (TTS)</li>
              <li><strong>DeepL:</strong> Pour la traduction EN → FR</li>
            </ul>
            <a
              href="https://github.com/PlumyCat/youtube-live-translator"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 underline"
            >
              📖 Voir le guide complet sur GitHub
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* Google Cloud Configuration */}
          <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl">☁️</div>
              <div>
                <h2 className="text-lg font-semibold text-white">Google Cloud</h2>
                <p className="text-sm text-gray-400">Configuration pour STT (Speech-to-Text) et TTS (Text-to-Speech)</p>
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
              <p className="text-xs text-gray-500">
                Votre Project ID Google Cloud (trouvable dans la console GCP)
              </p>
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
              <p className="text-xs text-gray-500">
                Fichier JSON de service account téléchargé depuis Google Cloud Console
              </p>
            </div>

            <div className="p-3 bg-yellow-900/20 border border-yellow-500 rounded text-xs text-yellow-400">
              <strong>💡 Comment obtenir ces informations:</strong>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>Créez un projet sur <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                <li>Activez les APIs "Cloud Speech-to-Text" et "Cloud Text-to-Speech"</li>
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
              <p className="text-xs text-gray-500">
                Votre clé API DeepL (gratuite ou Pro)
              </p>
            </div>

            <div className="p-3 bg-yellow-900/20 border border-yellow-500 rounded text-xs text-yellow-400">
              <strong>💡 Comment obtenir cette clé:</strong>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>Créez un compte sur <a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener noreferrer" className="underline">DeepL API</a></li>
                <li>Choisissez un plan (gratuit: 500 000 caractères/mois)</li>
                <li>Copiez votre clé API depuis le dashboard</li>
              </ol>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>

            <button
              onClick={handleTestConnection}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              Tester la connexion
            </button>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div className={`p-3 rounded-lg ${
              saveMessage.includes('succès')
                ? 'bg-green-900/20 border border-green-500 text-green-400'
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
