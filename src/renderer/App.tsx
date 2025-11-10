import { useState, useEffect } from 'react';
import { BatchProgressBar } from './components/BatchProgressBar';
import type { BatchProgress, BatchResult } from '@shared/types/batch';

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [error, setError] = useState('');

  // Batch mode state
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  useEffect(() => {
    // Setup batch event listeners
    const unsubBatchProgress = window.electronAPI.onBatchProgress((progress: BatchProgress) => {
      setBatchProgress(progress);
    });

    const unsubBatchCompleted = window.electronAPI.onBatchCompleted((result: BatchResult) => {
      setBatchResult(result);
      setBatchProgress(null);
    });

    const unsubBatchError = window.electronAPI.onBatchError((err: any) => {
      setError(err.message || 'Batch processing failed');
      setBatchProgress(null);
    });

    // Cleanup on unmount
    return () => {
      unsubBatchProgress();
      unsubBatchCompleted();
      unsubBatchError();
    };
  }, []);

  const handleStart = async () => {
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    try {
      setError('');
      setBatchResult(null);

      // Start batch processing
      await window.electronAPI.startBatch(youtubeUrl, collectionName.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start batch processing');
      setBatchProgress(null);
    }
  };

  const handleStop = async () => {
    try {
      await window.electronAPI.stopBatch();
      setBatchProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop processing');
    }
  };

  const openFile = async (filePath: string) => {
    try {
      await window.electronAPI.openExternal(filePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file');
    }
  };

  const openFolder = async (filePath: string) => {
    try {
      await window.electronAPI.showItemInFolder(filePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open folder');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-primary-400">YouTube Live Translator</h1>
          <p className="text-sm text-gray-400">
            Traduction batch - English → French
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* URL Input */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="youtube-url" className="block text-sm font-medium">
                YouTube URL
              </label>
              <input
                id="youtube-url"
                type="text"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={!!batchProgress}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="collection-name" className="block text-sm font-medium">
                Collection / Groupe <span className="text-gray-500">(optionnel)</span>
              </label>
              <input
                id="collection-name"
                type="text"
                value={collectionName}
                onChange={e => setCollectionName(e.target.value)}
                placeholder="Ex: Série Python, Tutoriels React, etc."
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={!!batchProgress}
              />
              <p className="text-xs text-gray-500">
                Les vidéos de la même collection seront regroupées dans un dossier dédié
              </p>
            </div>

            {!batchProgress ? (
              <button
                onClick={handleStart}
                className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                disabled={!youtubeUrl.trim()}
              >
                Lancer le traitement
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
              >
                Arrêter
              </button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Batch Progress */}
          {batchProgress && (
            <BatchProgressBar progress={batchProgress} />
          )}

          {/* Batch Result */}
          {batchResult && (
            <div className="p-6 bg-green-900/20 border border-green-500 rounded-lg space-y-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">✅</span>
                <div>
                  <h3 className="text-xl font-semibold text-green-400">Traitement terminé !</h3>
                  <p className="text-sm text-gray-400">Vidéo : {batchResult.videoTitle}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-green-700/50">
                <div>
                  <p className="text-xs text-gray-400">Durée vidéo</p>
                  <p className="text-lg font-medium text-white">{Math.floor(batchResult.videoDuration / 60)}min</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Segments traités</p>
                  <p className="text-lg font-medium text-white">{batchResult.processedSegments.length} / {batchResult.totalSegments}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Temps de traitement</p>
                  <p className="text-lg font-medium text-white">{Math.floor(batchResult.processingTime / 1000)}s</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Confiance moyenne</p>
                  <p className="text-lg font-medium text-white">
                    {(batchResult.processedSegments.reduce((acc, s) => acc + s.confidence, 0) / batchResult.processedSegments.length * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* Files Generated */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-green-400 flex items-center gap-2">
                  <span>📁</span>
                  Fichiers générés
                </h4>

                <div className="grid gap-2">
                  {/* Video with French audio */}
                  {batchResult.finalVideoPath && (
                    <button
                      onClick={() => openFile(batchResult.finalVideoPath!)}
                      className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 rounded-lg border border-gray-700 hover:border-primary-500 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🎬</span>
                        <div>
                          <p className="text-sm font-medium text-white">Vidéo avec audio français</p>
                          <p className="text-xs text-gray-400 font-mono">{batchResult.finalVideoPath.split(/[/\\]/).pop()}</p>
                        </div>
                      </div>
                      <span className="text-primary-400 text-sm">Ouvrir</span>
                    </button>
                  )}

                  {/* French audio only */}
                  <button
                    onClick={() => openFile(batchResult.finalAudioPath)}
                    className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 rounded-lg border border-gray-700 hover:border-primary-500 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎧</span>
                      <div>
                        <p className="text-sm font-medium text-white">Audio français seul</p>
                        <p className="text-xs text-gray-400 font-mono">{batchResult.finalAudioPath.split(/[/\\]/).pop()}</p>
                      </div>
                    </div>
                    <span className="text-primary-400 text-sm">Ouvrir</span>
                  </button>

                  {/* English transcript */}
                  {batchResult.transcriptOriginalPath && (
                    <button
                      onClick={() => openFile(batchResult.transcriptOriginalPath!)}
                      className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 rounded-lg border border-gray-700 hover:border-primary-500 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📄</span>
                        <div>
                          <p className="text-sm font-medium text-white">Transcript anglais (Markdown)</p>
                          <p className="text-xs text-gray-400 font-mono">{batchResult.transcriptOriginalPath.split(/[/\\]/).pop()}</p>
                        </div>
                      </div>
                      <span className="text-primary-400 text-sm">Ouvrir</span>
                    </button>
                  )}

                  {/* French transcript */}
                  {batchResult.transcriptTranslatedPath && (
                    <button
                      onClick={() => openFile(batchResult.transcriptTranslatedPath!)}
                      className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 rounded-lg border border-gray-700 hover:border-primary-500 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📝</span>
                        <div>
                          <p className="text-sm font-medium text-white">Transcript français (Markdown)</p>
                          <p className="text-xs text-gray-400 font-mono">{batchResult.transcriptTranslatedPath.split(/[/\\]/).pop()}</p>
                        </div>
                      </div>
                      <span className="text-primary-400 text-sm">Ouvrir</span>
                    </button>
                  )}

                  {/* Open folder button */}
                  <button
                    onClick={() => openFolder(batchResult.finalAudioPath)}
                    className="flex items-center justify-center gap-2 p-3 bg-gray-800 hover:bg-gray-750 rounded-lg border border-gray-700 hover:border-yellow-500 transition-colors"
                  >
                    <span className="text-xl">📂</span>
                    <span className="text-sm font-medium text-yellow-400">Ouvrir le dossier</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setBatchResult(null);
                  setYoutubeUrl('');
                  setCollectionName('');
                }}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
              >
                Traiter une nouvelle vidéo
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 bg-gray-800 border-t border-gray-700 text-center text-sm text-gray-400">
        <p>Built with ❤️ using Electron, React, and TypeScript</p>
      </footer>
    </div>
  );
}

export default App;
