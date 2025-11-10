import { BatchProgressBar } from './BatchProgressBar';
import type { QueueItem } from '@shared/types/batch';

interface QueueItemCardProps {
  item: QueueItem;
  onRemove?: (itemId: string) => void;
  onOpenFile?: (filePath: string) => void;
  onOpenFolder?: (filePath: string) => void;
}

export function QueueItemCard({ item, onRemove, onOpenFile, onOpenFolder }: QueueItemCardProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '⚙️';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '📄';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-gray-400';
      case 'processing':
        return 'text-blue-400';
      case 'completed':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-2xl flex-shrink-0">{getStatusIcon(item.status)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{item.url}</p>
            {item.collectionName && (
              <p className="text-xs text-gray-400">Collection: {item.collectionName}</p>
            )}
            <p className={`text-xs ${getStatusColor(item.status)}`}>
              {item.status === 'pending' && `Ajouté à ${formatTime(item.addedAt)}`}
              {item.status === 'processing' && `En cours depuis ${formatTime(item.startedAt!)}`}
              {item.status === 'completed' && `Terminé à ${formatTime(item.completedAt!)}`}
              {item.status === 'error' && `Erreur à ${formatTime(item.completedAt!)}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        {item.status === 'pending' && onRemove && (
          <button
            onClick={() => onRemove(item.id)}
            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded transition-colors"
          >
            Retirer
          </button>
        )}
      </div>

      {/* Progress (if processing) */}
      {item.status === 'processing' && item.progress && (
        <BatchProgressBar progress={item.progress} />
      )}

      {/* Error message */}
      {item.status === 'error' && item.error && (
        <div className="p-2 bg-red-900/20 border border-red-500 rounded text-xs text-red-400">
          {item.error}
        </div>
      )}

      {/* Completed result */}
      {item.status === 'completed' && item.result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{item.result.videoTitle}</span>
            <span className="text-xs text-gray-400">
              {Math.floor(item.result.videoDuration / 60)}min
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Video */}
            {item.result.finalVideoPath && onOpenFile && (
              <button
                onClick={() => onOpenFile(item.result!.finalVideoPath!)}
                className="flex items-center gap-2 p-2 bg-gray-750 hover:bg-gray-700 rounded text-xs border border-gray-600 hover:border-primary-500 transition-colors"
              >
                <span>🎬</span>
                <span>Vidéo</span>
              </button>
            )}

            {/* Audio */}
            {item.result.finalAudioPath && onOpenFile && (
              <button
                onClick={() => onOpenFile(item.result!.finalAudioPath)}
                className="flex items-center gap-2 p-2 bg-gray-750 hover:bg-gray-700 rounded text-xs border border-gray-600 hover:border-primary-500 transition-colors"
              >
                <span>🎧</span>
                <span>Audio</span>
              </button>
            )}

            {/* Transcript EN */}
            {item.result.transcriptOriginalPath && onOpenFile && (
              <button
                onClick={() => onOpenFile(item.result!.transcriptOriginalPath!)}
                className="flex items-center gap-2 p-2 bg-gray-750 hover:bg-gray-700 rounded text-xs border border-gray-600 hover:border-primary-500 transition-colors"
              >
                <span>📄</span>
                <span>EN</span>
              </button>
            )}

            {/* Transcript FR */}
            {item.result.transcriptTranslatedPath && onOpenFile && (
              <button
                onClick={() => onOpenFile(item.result!.transcriptTranslatedPath!)}
                className="flex items-center gap-2 p-2 bg-gray-750 hover:bg-gray-700 rounded text-xs border border-gray-600 hover:border-primary-500 transition-colors"
              >
                <span>📝</span>
                <span>FR</span>
              </button>
            )}
          </div>

          {/* Open folder button */}
          {onOpenFolder && (
            <button
              onClick={() => onOpenFolder(item.result!.finalAudioPath)}
              className="w-full flex items-center justify-center gap-2 p-2 bg-gray-750 hover:bg-gray-700 rounded text-xs border border-gray-600 hover:border-yellow-500 transition-colors"
            >
              <span>📂</span>
              <span className="text-yellow-400">Ouvrir le dossier</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
