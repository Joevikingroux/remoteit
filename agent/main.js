const { app, BrowserWindow, clipboard, desktopCapturer, dialog, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { init: initInput, handleInputEvent, getScreenSize } = require('./src/input');

let mainWindow;
let controlWindow;
let tray;
let isControlActive = false;

// Server URL — change this for production
const SERVER_URL = 'https://remoteit.numbers10.co.za';

function createMainWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: 450,
    height: 520,
    x: Math.round((screenW - 450) / 2),
    y: Math.round((screenH - 520) / 2),
    resizable: false,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createControlToolbar() {
  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;

  controlWindow = new BrowserWindow({
    width: 400,
    height: 50,
    x: Math.round((width - 400) / 2),
    y: 0,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  controlWindow.loadFile(path.join(__dirname, 'renderer', 'toolbar.html'));
  controlWindow.setAlwaysOnTop(true, 'screen-saver');
}

function destroyControlToolbar() {
  if (controlWindow) {
    controlWindow.close();
    controlWindow = null;
  }
}

app.whenReady().then(() => {
  // Initialize input injection
  const inputReady = initInput();
  console.log('Input injection:', inputReady ? 'ready' : 'failed');

  createMainWindow();

  // Register revoke hotkey: Ctrl+Shift+F12
  globalShortcut.register('Ctrl+Shift+F12', () => {
    if (isControlActive) {
      isControlActive = false;
      destroyControlToolbar();
      mainWindow?.webContents.send('control-revoked-local');
    }
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  app.quit();
});

// ── IPC Handlers ──

ipcMain.handle('get-server-url', () => SERVER_URL);

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 320, height: 180 },
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
  }));
});

ipcMain.handle('get-screen-size', () => {
  return getScreenSize();
});

ipcMain.on('input-event', (_event, data) => {
  if (!isControlActive) return;
  handleInputEvent(data);
});

ipcMain.on('control-request', (_event, technicianName) => {
  // Show consent dialog via renderer
  mainWindow?.webContents.send('show-consent', technicianName);
});

ipcMain.on('control-granted', () => {
  isControlActive = true;
  createControlToolbar();
});

ipcMain.on('control-denied', () => {
  isControlActive = false;
});

ipcMain.on('control-revoke', () => {
  isControlActive = false;
  destroyControlToolbar();
});

ipcMain.on('session-ended', () => {
  isControlActive = false;
  destroyControlToolbar();
  globalShortcut.unregisterAll();
});

// ── Clipboard ──
ipcMain.handle('clipboard-read', () => {
  return clipboard.readText();
});

ipcMain.handle('clipboard-write', (_event, text) => {
  clipboard.writeText(text);
  return true;
});

// ── File Transfer (receive from technician) ──
const pendingFiles = new Map();

ipcMain.on('file-start', (_event, data) => {
  // data: { fileId, filename, size }
  const downloadsPath = app.getPath('downloads');
  const safeName = data.filename.replace(/[<>:"/\\|?*]/g, '_');
  const filePath = path.join(downloadsPath, safeName);
  const writeStream = fs.createWriteStream(filePath);
  pendingFiles.set(data.fileId, { writeStream, filePath, received: 0, size: data.size });
  console.log(`Receiving file: ${safeName} (${data.size} bytes)`);
});

ipcMain.on('file-chunk', (_event, data) => {
  // data: { fileId, chunk (base64) }
  const file = pendingFiles.get(data.fileId);
  if (!file) return;
  const buffer = Buffer.from(data.chunk, 'base64');
  file.writeStream.write(buffer);
  file.received += buffer.length;
});

ipcMain.on('file-end', (_event, data) => {
  // data: { fileId }
  const file = pendingFiles.get(data.fileId);
  if (!file) return;
  file.writeStream.end();
  pendingFiles.delete(data.fileId);
  console.log(`File saved: ${file.filePath}`);
  // Notify the renderer to show confirmation
  mainWindow?.webContents.send('file-received', { filename: path.basename(file.filePath), path: file.filePath });
});
