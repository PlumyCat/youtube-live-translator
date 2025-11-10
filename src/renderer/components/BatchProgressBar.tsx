/**
 * Batch Processing Progress Bar Component
 */
import { BatchProgress } from '@shared/types/batch';

interface BatchProgressBarProps {
  progress: BatchProgress;
}

export function BatchProgressBar({ progress }: BatchProgressBarProps) {
  const getPhaseIcon = (status: string) => {
    switch (status) {
      case 'downloading':
        return '⬇️';
      case 'segmenting':
        return '✂️';
      case 'processing':
        return '⚙️';
      case 'assembling':
        return '🔨';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getPhaseColor = (status: string) => {
    switch (status) {
      case 'downloading':
        return 'text-blue-400';
      case 'segmenting':
        return 'text-purple-400';
      case 'processing':
        return 'text-yellow-400';
      case 'assembling':
        return 'text-orange-400';
      case 'completed':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage < 25) return 'bg-blue-500';
    if (percentage < 50) return 'bg-purple-500';
    if (percentage < 75) return 'bg-yellow-500';
    if (percentage < 100) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return null;

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <div className="p-6 bg-gray-800 rounded-lg border border-gray-700 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getPhaseIcon(progress.status)}</span>
          <div>
            <h3 className={`text-lg font-semibold ${getPhaseColor(progress.status)}`}>
              {progress.phase}
            </h3>
            <p className="text-sm text-gray-400">{progress.message}</p>
          </div>
        </div>

        {progress.estimatedTimeRemaining && (
          <div className="text-right">
            <p className="text-xs text-gray-400">Temps restant</p>
            <p className="text-sm font-medium text-gray-300">
              {formatTimeRemaining(progress.estimatedTimeRemaining)}
            </p>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Progression</span>
          <span className="font-medium text-white">{Math.round(progress.percentage)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-500 ease-out ${getProgressColor(progress.percentage)}`}
            style={{ width: `${Math.min(100, Math.max(0, progress.percentage))}%` }}
          />
        </div>
      </div>

      {/* Segment Progress */}
      {progress.totalSegments > 0 && (
        <div className="pt-2 border-t border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Segments</span>
            <span className="font-medium text-gray-300">
              {progress.currentSegment} / {progress.totalSegments}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-10 gap-1">
            {Array.from({ length: progress.totalSegments }, (_, i) => (
              <div
                key={i}
                className={`h-2 rounded-sm transition-colors ${
                  i < progress.currentSegment
                    ? 'bg-green-500'
                    : i === progress.currentSegment
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-gray-600'
                }`}
                title={`Segment ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Status Indicators */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-700">
        <div className={`text-center p-2 rounded ${progress.status === 'downloading' || progress.percentage > 5 ? 'bg-blue-500/20' : 'bg-gray-700/50'}`}>
          <div className="text-xs text-gray-400">Téléchargement</div>
          <div className={`text-lg ${progress.percentage > 5 ? 'text-blue-400' : 'text-gray-500'}`}>
            {progress.percentage > 5 ? '✓' : '○'}
          </div>
        </div>

        <div className={`text-center p-2 rounded ${progress.status === 'segmenting' || progress.percentage > 20 ? 'bg-purple-500/20' : 'bg-gray-700/50'}`}>
          <div className="text-xs text-gray-400">Découpage</div>
          <div className={`text-lg ${progress.percentage > 20 ? 'text-purple-400' : 'text-gray-500'}`}>
            {progress.percentage > 20 ? '✓' : '○'}
          </div>
        </div>

        <div className={`text-center p-2 rounded ${progress.status === 'processing' || progress.percentage > 95 ? 'bg-yellow-500/20' : 'bg-gray-700/50'}`}>
          <div className="text-xs text-gray-400">Traitement</div>
          <div className={`text-lg ${progress.percentage > 95 ? 'text-yellow-400' : 'text-gray-500'}`}>
            {progress.percentage > 95 ? '✓' : progress.status === 'processing' ? '⚙' : '○'}
          </div>
        </div>

        <div className={`text-center p-2 rounded ${progress.status === 'assembling' || progress.percentage === 100 ? 'bg-orange-500/20' : 'bg-gray-700/50'}`}>
          <div className="text-xs text-gray-400">Assemblage</div>
          <div className={`text-lg ${progress.percentage === 100 ? 'text-green-400' : progress.status === 'assembling' ? 'text-orange-400' : 'text-gray-500'}`}>
            {progress.percentage === 100 ? '✓' : progress.status === 'assembling' ? '🔨' : '○'}
          </div>
        </div>
      </div>
    </div>
  );
}
