import { useState, useEffect } from 'react';

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'translating' | 'error'>('idle');
  const [currentLatency, setCurrentLatency] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Setup event listeners
    const unsubLatency = window.electronAPI.onLatencyUpdate(setCurrentLatency);
    const unsubTranscript = window.electronAPI.onTranscriptUpdate(setTranscript);
    const unsubTranslation = window.electronAPI.onTranslationUpdate(setTranslation);
    const unsubStatus = window.electronAPI.onStatusChange(newStatus => {
      setStatus(newStatus as 'idle' | 'translating' | 'error');
    });
    const unsubError = window.electronAPI.onError(setError);

    // Cleanup on unmount
    return () => {
      unsubLatency();
      unsubTranscript();
      unsubTranslation();
      unsubStatus();
      unsubError();
    };
  }, []);

  const handleStart = async () => {
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    try {
      setError('');
      await window.electronAPI.startTranslation(youtubeUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start translation');
    }
  };

  const handleStop = async () => {
    try {
      await window.electronAPI.stopTranslation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop translation');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-primary-400">YouTube Live Translator</h1>
        <p className="text-sm text-gray-400">Real-time English → French translation</p>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* URL Input */}
          <div className="space-y-2">
            <label htmlFor="youtube-url" className="block text-sm font-medium">
              YouTube URL
            </label>
            <div className="flex gap-2">
              <input
                id="youtube-url"
                type="text"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={status === 'translating'}
              />
              {status !== 'translating' ? (
                <button
                  onClick={handleStart}
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                  disabled={!youtubeUrl.trim()}
                >
                  Start
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Status Display */}
          {status === 'translating' && (
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Status</span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-green-400">Translating</span>
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Latency</span>
                  <span className={currentLatency < 2000 ? 'text-green-400' : 'text-red-400'}>
                    {currentLatency}ms
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      currentLatency < 2000 ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, (currentLatency / 2000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Transcript and Translation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Original (English)</h3>
              <p className="text-white min-h-[100px]">{transcript || 'Waiting for audio...'}</p>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Translation (French)</h3>
              <p className="text-white min-h-[100px]">
                {translation || 'Waiting for translation...'}
              </p>
            </div>
          </div>
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
