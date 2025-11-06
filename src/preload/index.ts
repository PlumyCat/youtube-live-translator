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
    };
  }
}
