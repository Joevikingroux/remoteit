const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agent', {
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  getSources: () => ipcRenderer.invoke('get-sources'),
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),

  sendInputEvent: (event) => ipcRenderer.send('input-event', event),
  controlGranted: () => ipcRenderer.send('control-granted'),
  controlDenied: () => ipcRenderer.send('control-denied'),
  controlRevoke: () => ipcRenderer.send('control-revoke'),
  sessionEnded: () => ipcRenderer.send('session-ended'),

  onShowConsent: (callback) => ipcRenderer.on('show-consent', (_e, name) => callback(name)),
  onControlRevokedLocal: (callback) => ipcRenderer.on('control-revoked-local', () => callback()),

  // Clipboard
  clipboardRead: () => ipcRenderer.invoke('clipboard-read'),
  clipboardWrite: (text) => ipcRenderer.invoke('clipboard-write', text),

  // File transfer (receive)
  fileStart: (data) => ipcRenderer.send('file-start', data),
  fileChunk: (data) => ipcRenderer.send('file-chunk', data),
  fileEnd: (data) => ipcRenderer.send('file-end', data),
  onFileReceived: (callback) => ipcRenderer.on('file-received', (_e, data) => callback(data)),
});
