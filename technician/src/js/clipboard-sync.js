// Clipboard sync via Tauri commands + DataChannel
const ClipboardSync = {
  statusTimeout: null,

  async pasteToClient() {
    try {
      // Read clipboard using Tauri plugin
      const text = await window.__TAURI__.clipboardManager.readText();
      if (!text) {
        this.showStatus('Clipboard is empty');
        return;
      }
      WebRTCManager.sendInput({ type: 'clipboard-sync', text });
      this.showStatus('Clipboard sent to client');
    } catch (err) {
      this.showStatus('Clipboard access failed');
    }
  },

  copyFromClient() {
    WebRTCManager.sendInput({ type: 'clipboard-request' });
    this.showStatus('Requesting clipboard...');
  },

  async onReceived(text) {
    try {
      await window.__TAURI__.clipboardManager.writeText(text);
      this.showStatus('Clipboard received from client');
    } catch {
      this.showStatus('Failed to write clipboard');
    }
  },

  showStatus(msg) {
    const el = document.getElementById('clipboard-status');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this.statusTimeout);
    this.statusTimeout = setTimeout(() => el.classList.add('hidden'), 3000);
  },
};
