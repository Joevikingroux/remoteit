// Seamless clipboard sync — auto-syncs clipboard changes bidirectionally
// like AnyDesk/TeamViewer. No buttons needed.
const ClipboardSync = {
  pollInterval: null,
  lastText: '',
  active: false,

  // Start polling clipboard for changes — auto-sends to client
  start() {
    if (this.active) return;
    this.active = true;
    this.lastText = '';

    this.pollInterval = setInterval(async () => {
      try {
        const text = await window.__TAURI__.clipboardManager.readText();
        if (text && text !== this.lastText) {
          this.lastText = text;
          WebRTCManager.sendInput({ type: 'clipboard-sync', text });
        }
      } catch {}
    }, 300);
  },

  stop() {
    this.active = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  },

  // Called when clipboard text is received from client
  async onReceived(text) {
    try {
      this.lastText = text; // prevent re-sending what we just received
      await window.__TAURI__.clipboardManager.writeText(text);
    } catch {}
  },

  // Sync current clipboard to client immediately (called before Ctrl+V)
  async syncToClient() {
    try {
      const text = await window.__TAURI__.clipboardManager.readText();
      if (text) {
        this.lastText = text;
        WebRTCManager.sendInput({ type: 'clipboard-sync', text });
      }
    } catch {}
  },

  // Request client's clipboard (called after Ctrl+C on remote)
  requestFromClient() {
    WebRTCManager.sendInput({ type: 'clipboard-request' });
  },
};
