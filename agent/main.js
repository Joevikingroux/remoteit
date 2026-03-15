const { app, BrowserWindow, desktopCapturer, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { init: initInput, handleInputEvent, getScreenSize } = require('./src/input');

let mainWindow;
let controlWindow;
let tray;
let isControlActive = false;

// Server URL — change this for production
const SERVER_URL = 'https://remoteit.numbers10.co.za';

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 550,
    resizable: false,
    maximizable: false,
    icon: path.join(__dirname, 'renderer', 'icon.png'),
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
