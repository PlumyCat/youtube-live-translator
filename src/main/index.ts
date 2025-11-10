import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { registerPipelineHandlers, cleanupPipelineHandlers } from './ipc/pipeline-handlers';
import { registerBatchHandlers, cleanupBatchHandlers } from './ipc/batch-handlers';
import { registerConfigHandlers } from './ipc/config-handlers';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  logger.info('Creating main window');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Security: no Node.js in renderer
      contextIsolation: true, // Security: isolated contexts
      sandbox: true, // Security: sandboxed renderer
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Register IPC handlers
  registerPipelineHandlers(mainWindow);
  registerBatchHandlers(mainWindow);
  registerConfigHandlers();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info('Main window created');
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  logger.info('All windows closed');

  // Cleanup handlers
  await cleanupPipelineHandlers();
  await cleanupBatchHandlers();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
