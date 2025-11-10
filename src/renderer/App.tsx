import { useState, useEffect } from 'react';
import { QueueItemCard } from './components/QueueItemCard';
import type { QueueState, QueueItem } from '@shared/types/batch';

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [error, setError] = useState('');
  const [queueState, setQueueState] = useState<QueueState>({
    items: [],
    isProcessing: false,
  });

  useEffect(() => {
    // Load initial queue state
    window.electronAPI.getQueue().then(setQueueState).catch(console.error);

    // Setup queue event listeners
    const unsubQueueUpdate = window.electronAPI.onQueueUpdate((state: QueueState) => {
      setQueueState(state);
    });

    const unsubItemProgress = window.electronAPI.onQueueItemProgress((item: QueueItem) => {
      setQueueState(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === item.id ? item : i),
      }));
    });

    const unsubItemCompleted = window.electronAPI.onQueueItemCompleted((item: QueueItem) => {
      setQueueState(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === item.id ? item : i),
      }));
    });

    const unsubItemError = window.electronAPI.onQueueItemError((item: QueueItem) => {
      setQueueState(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === item.id ? item : i),
      }));
    });

    // Cleanup on unmount
    return () => {
      unsubQueueUpdate();
      unsubItemProgress();
      unsubItemCompleted();
      unsubItemError();
    };
  }, []);

  const handleAddToQueue = async () => {
    if (!youtubeUrl.trim()) {
      setError('Veuillez entrer une URL YouTube');
      return;
    }

    try {
      setError('');
      await window.electronAPI.addToQueue(youtubeUrl, collectionName.trim() || undefined);
      setYoutubeUrl(''); // Clear input after adding
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajout à la queue');
    }
  };

  const handleRemoveFromQueue = async (itemId: string) => {
    try {
      await window.electronAPI.removeFromQueue(itemId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  const handleClearQueue = async () => {
    try {
      await window.electronAPI.clearQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression de la queue');
    }
  };

  const handleStopQueue = async () => {
    try {
      await window.electronAPI.stopQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'arrêt');
    }
  };

  const openFile = async (filePath: string) => {
    try {
      await window.electronAPI.openExternal(filePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ouverture du fichier');
    }
  };

  const openFolder = async (filePath: string) => {
    try {
      await window.electronAPI.showItemInFolder(filePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ouverture du dossier');
    }
  };

  const pendingCount = queueState.items.filter(i => i.status === 'pending').length;
  const processingCount = queueState.items.filter(i => i.status === 'processing').length;
  const completedCount = queueState.items.filter(i => i.status === 'completed').length;
  const errorCount = queueState.items.filter(i => i.status === 'error').length;

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-400">YouTube Live Translator</h1>
            <p className="text-sm text-gray-400">
              File d'attente de traduction - English → French
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">⏳ Pending:</span>
              <span className="font-medium">{pendingCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">⚙️ Processing:</span>
              <span className="font-medium">{processingCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✅ Completed:</span>
              <span className="font-medium">{completedCount}</span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-red-400">❌ Errors:</span>
                <span className="font-medium">{errorCount}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Add to Queue Form */}
          <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
            <h2 className="text-lg font-semibold text-primary-400">Ajouter une vidéo</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="youtube-url" className="block text-sm font-medium">
                  URL YouTube
                </label>
                <input
                  id="youtube-url"
                  type="text"
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddToQueue()}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="collection-name" className="block text-sm font-medium">
                  Collection <span className="text-gray-500">(optionnel)</span>
                </label>
                <input
                  id="collection-name"
                  type="text"
                  value={collectionName}
                  onChange={e => setCollectionName(e.target.value)}
                  placeholder="Ex: Série Python, Tutoriels React..."
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddToQueue}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                disabled={!youtubeUrl.trim()}
              >
                Ajouter à la file
              </button>

              {pendingCount > 0 && (
                <button
                  onClick={handleClearQueue}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                >
                  Vider la file ({pendingCount})
                </button>
              )}

              {queueState.isProcessing && (
                <button
                  onClick={handleStopQueue}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                >
                  Arrêter le traitement
                </button>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Queue List */}
          {queueState.items.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">
                File d'attente ({queueState.items.length})
              </h2>
              <div className="space-y-3">
                {queueState.items.map(item => (
                  <QueueItemCard
                    key={item.id}
                    item={item}
                    onRemove={handleRemoveFromQueue}
                    onOpenFile={openFile}
                    onOpenFolder={openFolder}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="p-12 bg-gray-800 border border-gray-700 rounded-lg text-center">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold text-gray-400 mb-2">
                File d'attente vide
              </h3>
              <p className="text-sm text-gray-500">
                Ajoutez une ou plusieurs vidéos YouTube pour commencer
              </p>
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
