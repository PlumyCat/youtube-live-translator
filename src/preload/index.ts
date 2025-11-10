import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Translation control
  startTranslation: (url: string) => ipcRenderer.invoke('translation:start', url),
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
  addToQueue: (url: string, collectionName?: string) => ipcRenderer.invoke('queue:add', url, collectionName),
  removeFromQueue: (itemId: string) => ipcRenderer.invoke('queue:remove', itemId),
  clearQueue: () => ipcRenderer.invoke('queue:clear'),
  getQueue: () => ipcRenderer.invoke('queue:get'),
  stopQueue: () => ipcRenderer.invoke('queue:stop'),

  onQueueUpdate: (callback: (state: any) => void) => {
    const subscription = (_event: unknown, state: any) => callback(state);
    ipcRenderer.on('queue:update', subscription);
    return () => ipcRenderer.removeListener('queue:update', subscription);
  },

  onQueueItemProgress: (callback: (item: any) => void) => {
    const subscription = (_event: unknown, item: any) => callback(item);
    ipcRenderer.on('queue:item-progress', subscription);
    return () => ipcRenderer.removeListener('queue:item-progress', subscription);
  },

  onQueueItemCompleted: (callback: (item: any) => void) => {
    const subscription = (_event: unknown, item: any) => callback(item);
    ipcRenderer.on('queue:item-completed', subscription);
    return () => ipcRenderer.removeListener('queue:item-completed', subscription);
  },

  onQueueItemError: (callback: (item: any) => void) => {
    const subscription = (_event: unknown, item: any) => callback(item);
    ipcRenderer.on('queue:item-error', subscription);
    return () => ipcRenderer.removeListener('queue:item-error', subscription);
  },

  // File operations
  openExternal: (path: string) => ipcRenderer.invoke('shell:openExternal', path),
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path),
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
      addToQueue: (url: string, collectionName?: string) => Promise<any>;
      removeFromQueue: (itemId: string) => Promise<boolean>;
      clearQueue: () => Promise<number>;
      getQueue: () => Promise<any>;
      stopQueue: () => Promise<void>;
      onQueueUpdate: (callback: (state: any) => void) => () => void;
      onQueueItemProgress: (callback: (item: any) => void) => () => void;
      onQueueItemCompleted: (callback: (item: any) => void) => () => void;
      onQueueItemError: (callback: (item: any) => void) => () => void;
      // File operations
      openExternal: (path: string) => Promise<void>;
      showItemInFolder: (path: string) => Promise<void>;
    };
  }
}
