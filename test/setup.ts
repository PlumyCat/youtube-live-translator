/**
 * Test setup file
 * Runs before all tests
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project-id';
process.env.GOOGLE_CLOUD_KEY_PATH = '/path/to/test-key.json';
process.env.DEEPL_API_KEY = 'test-deepl-key';

// Mock Electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/tmp/test-user-data';
      return '/tmp/test';
    }),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  ipcMain: {
    on: vi.fn(),
    handle: vi.fn(),
  },
  ipcRenderer: {
    on: vi.fn(),
    invoke: vi.fn(),
    removeListener: vi.fn(),
  },
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));

// Mock pino logger
const mockPino = Object.assign(
  vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(function() { return this; }),
  })),
  {
    stdTimeFunctions: {
      isoTime: vi.fn(() => new Date().toISOString()),
    },
  }
);

vi.mock('pino', () => ({
  default: mockPino,
}));

// Mock pino-pretty
vi.mock('pino-pretty', () => ({
  default: vi.fn(),
}));
