import { contextBridge, ipcRenderer } from 'electron';
import { isValidYouTubeUrl, isValidFilePath } from '../shared/utils/validation';
import type { QueueState, QueueItem } from '../shared/types/batch';
import type { PartialServiceConfig } from '../shared/types/services';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Translation control
  startTranslation: (url: string) => {
    if (!isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL format');
    }
    return ipcRenderer.invoke('translation:start', url);
  },
  stopTranslation: () => ipcRenderer.invoke('translation:stop'),

  // Event listeners
  onLatencyUpdate: (callback: (latency: number) => void) => {
    const subscription = (_event: unknown, latency: number) => callback(latency);
    ipcRenderer.on('latency-update', subscription);
    return () => ipcRenderer.removeListener('latency-update', subscription);
  },

  onTranscriptUpdate: (callback: (text: string) => void) => {
    const subscription = (_event: unknown, text: string) => callback(text);
    ipcRenderer.on('transcript-update', subscription);
    return () => ipcRenderer.removeListener('transcript-update', subscription);
  },

  onTranslationUpdate: (callback: (text: string) => void) => {
    const subscription = (_event: unknown, text: string) => callback(text);
    ipcRenderer.on('translation-update', subscription);
    return () => ipcRenderer.removeListener('translation-update', subscription);
  },

  onStatusChange: (callback: (status: string) => void) => {
    const subscription = (_event: unknown, status: string) => callback(status);
    ipcRenderer.on('status-change', subscription);
    return () => ipcRenderer.removeListener('status-change', subscription);
  },

  onError: (callback: (error: string) => void) => {
    const subscription = (_event: unknown, error: string) => callback(error);
    ipcRenderer.on('error', subscription);
    return () => ipcRenderer.removeListener('error', subscription);
  },

  // Queue processing
  addToQueue: (url: string, collectionName?: string) => {
    if (!isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL format');
    }
    return ipcRenderer.invoke('queue:add', url, collectionName);
  },
  removeFromQueue: (itemId: string) => ipcRenderer.invoke('queue:remove', itemId),
  clearQueue: () => ipcRenderer.invoke('queue:clear'),
  getQueue: () => ipcRenderer.invoke('queue:get'),
  stopQueue: () => ipcRenderer.invoke('queue:stop'),

  onQueueUpdate: (callback: (state: QueueState) => void) => {
    const subscription = (_event: unknown, state: QueueState) => callback(state);
    ipcRenderer.on('queue:update', subscription);
    return () => ipcRenderer.removeListener('queue:update', subscription);
  },

  onQueueItemProgress: (callback: (item: QueueItem) => void) => {
    const subscription = (_event: unknown, item: QueueItem) => callback(item);
    ipcRenderer.on('queue:item-progress', subscription);
    return () => ipcRenderer.removeListener('queue:item-progress', subscription);
  },

  onQueueItemCompleted: (callback: (item: QueueItem) => void) => {
    const subscription = (_event: unknown, item: QueueItem) => callback(item);
    ipcRenderer.on('queue:item-completed', subscription);
    return () => ipcRenderer.removeListener('queue:item-completed', subscription);
  },

  onQueueItemError: (callback: (item: QueueItem) => void) => {
    const subscription = (_event: unknown, item: QueueItem) => callback(item);
    ipcRenderer.on('queue:item-error', subscription);
    return () => ipcRenderer.removeListener('queue:item-error', subscription);
  },

  // File operations
  openExternal: (path: string) => {
    if (!isValidFilePath(path)) {
      throw new Error('Invalid file path');
    }
    return ipcRenderer.invoke('shell:openExternal', path);
  },
  showItemInFolder: (path: string) => {
    if (!isValidFilePath(path)) {
      throw new Error('Invalid file path');
    }
    return ipcRenderer.invoke('shell:showItemInFolder', path);
  },

  // Service configuration
  getServiceConfig: () => ipcRenderer.invoke('config:get'),
  saveServiceConfig: (config: PartialServiceConfig) => ipcRenderer.invoke('config:save', config),
  selectKeyFile: () => ipcRenderer.invoke('config:select-key-file'),
  validateKeyFile: (filePath: string) => ipcRenderer.invoke('config:validate-key-file', filePath),
  testConnection: () => ipcRenderer.invoke('config:test-connection'),
});

// Type declarations for TypeScript
declare global {
  interface Window {
    electronAPI: {
      startTranslation: (url: string) => Promise<void>;
      stopTranslation: () => Promise<void>;
      onLatencyUpdate: (callback: (latency: number) => void) => () => void;
      onTranscriptUpdate: (callback: (text: string) => void) => () => void;
      onTranslationUpdate: (callback: (text: string) => void) => () => void;
      onStatusChange: (callback: (status: string) => void) => () => void;
      onError: (callback: (error: string) => void) => () => void;
      // Queue processing
      addToQueue: (url: string, collectionName?: string) => Promise<QueueItem>;
      removeFromQueue: (itemId: string) => Promise<boolean>;
      clearQueue: () => Promise<number>;
      getQueue: () => Promise<QueueState>;
      stopQueue: () => Promise<void>;
      onQueueUpdate: (callback: (state: QueueState) => void) => () => void;
      onQueueItemProgress: (callback: (item: QueueItem) => void) => () => void;
      onQueueItemCompleted: (callback: (item: QueueItem) => void) => () => void;
      onQueueItemError: (callback: (item: QueueItem) => void) => () => void;
      // File operations
      openExternal: (path: string) => Promise<void>;
      showItemInFolder: (path: string) => Promise<void>;
      // Service configuration
      getServiceConfig: () => Promise<PartialServiceConfig>;
      saveServiceConfig: (config: PartialServiceConfig) => Promise<{ success: boolean }>;
      selectKeyFile: () => Promise<string | null>;
      validateKeyFile: (filePath: string) => Promise<boolean>;
      testConnection: () => Promise<{ success: boolean; message: string }>;
    };
  }
}
