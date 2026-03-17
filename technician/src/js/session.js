// Session viewer: video, input capture, control
const Session = {
  sessionCode: null,
  controlRequested: false,

  async connect(code) {
    this.sessionCode = code;
    this.controlRequested = false;

    // Claim session
    try {
      await apiFetch(`/sessions/${code}/claim`, { method: 'POST' });
    } catch (err) {
      console.log('Claim result:', err.message);
    }

    // Show session view
    Dashboard.unload();
    App.showView('session');

    // Update UI
    const formatted = code.match(/.{1,2}/g)?.join(' ') || code;
    document.getElementById('session-code-display').textContent = `Session: ${formatted}`;
    document.getElementById('peer-status').className = 'status-badge waiting';
    document.getElementById('peer-status').innerHTML = '<span class="status-dot"></span> Waiting for client...';
    document.getElementById('video-placeholder').classList.remove('hidden');
    document.getElementById('remote-video').classList.add('hidden');
    document.getElementById('control-btn').classList.add('hidden');
    document.getElementById('release-btn').classList.add('hidden');
    document.getElementById('control-active-bar').classList.add('hidden');

    // Connect socket
    SocketManager.onPeerJoined = () => this.onPeerJoined();
    SocketManager.onPeerLeft = () => this.onPeerLeft();
    SocketManager.onError = (msg) => this.onError(msg);
    SocketManager.connect(code);
  },

  onPeerJoined() {
    document.getElementById('peer-status').className = 'status-badge connected';
    document.getElementById('peer-status').innerHTML = '<span class="status-dot"></span> Client Connected';
    document.getElementById('control-btn').classList.remove('hidden');

    // Setup WebRTC
    WebRTCManager.onRemoteStream = (stream) => this.onRemoteStream(stream);
    WebRTCManager.onConnectionState = (state) => this.onConnectionState(state);
    WebRTCManager.onControlChanged = (granted) => this.onControlChanged(granted);
    WebRTCManager.setup(this.sessionCode);

    // Start clipboard auto-sync
    ClipboardSync.start();
  },

  onPeerLeft() {
    document.getElementById('peer-status').className = 'status-badge waiting';
    document.getElementById('peer-status').innerHTML = '<span class="status-dot"></span> Client Disconnected';
    document.getElementById('control-btn').classList.add('hidden');
    this.onControlChanged(false);
    ClipboardSync.stop();
    WebRTCManager.close();
  },

  onError(msg) {
    document.getElementById('conn-state').textContent = `Error: ${msg}`;
  },

  onRemoteStream(stream) {
    const video = document.getElementById('remote-video');
    video.srcObject = stream;
    video.classList.remove('hidden');
    document.getElementById('video-placeholder').classList.add('hidden');
  },

  onConnectionState(state) {
    document.getElementById('conn-state').textContent = `Connection: ${state}`;
  },

  onControlChanged(granted) {
    const controlBtn = document.getElementById('control-btn');
    const releaseBtn = document.getElementById('release-btn');
    const controlBar = document.getElementById('control-active-bar');
    const videoArea = document.getElementById('video-container');
    const sasBtn = document.getElementById('sas-btn');
    const sasSep = document.getElementById('sas-sep');

    if (granted) {
      controlBtn.classList.add('hidden');
      releaseBtn.classList.remove('hidden');
      controlBar.classList.remove('hidden');
      sasBtn.classList.remove('hidden');
      sasSep.classList.remove('hidden');
      videoArea.classList.add('control-active');
      this.attachInputListeners();
      window.__TAURI__?.core?.invoke('create_toolbar').catch(() => {});
    } else {
      controlBtn.classList.remove('hidden');
      releaseBtn.classList.add('hidden');
      controlBar.classList.add('hidden');
      sasBtn.classList.add('hidden');
      sasSep.classList.add('hidden');
      videoArea.classList.remove('control-active');
      controlBtn.textContent = 'Request Control';
      controlBtn.disabled = false;
      this.controlRequested = false;
      this.detachInputListeners();
      window.__TAURI__?.core?.invoke('destroy_toolbar').catch(() => {});
    }
  },

  handleRequestControl() {
    const name = Auth.getUser()?.name || 'Technician';
    WebRTCManager.requestControl(name, this.sessionCode);
    this.controlRequested = true;
    document.getElementById('control-btn').textContent = 'Waiting for approval...';
    document.getElementById('control-btn').disabled = true;
  },

  handleReleaseControl() {
    WebRTCManager.releaseControl(this.sessionCode);
  },

  // Screenshot: capture current video frame as PNG
  takeScreenshot() {
    const video = document.getElementById('remote-video');
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screenshot-${this.sessionCode}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  },

  async endSession() {
    // Save notes before ending
    if (NotesPanel.notes || NotesPanel.tags.length > 0) {
      await NotesPanel.save().catch(() => {});
    }
    try {
      await apiFetch(`/sessions/${this.sessionCode}/end`, { method: 'POST' }).catch(() => {});
    } catch {}
    ClipboardSync.stop();
    ChatPanel.reset();
    SystemInfoPanel.reset();
    NotesPanel.reset();
    WebRTCManager.close();
    SocketManager.disconnect();
    window.__TAURI__?.core?.invoke('destroy_toolbar').catch(() => {});
    App.showView('dashboard');
    Dashboard.load();
  },

  // ── Input Handling ──
  getNormalizedPosition(e) {
    const video = document.getElementById('remote-video');
    if (!video || !video.videoWidth) return null;

    const rect = video.getBoundingClientRect();
    const videoAspect = video.videoWidth / video.videoHeight;
    const elemAspect = rect.width / rect.height;

    let vx, vy, vw, vh;
    if (videoAspect > elemAspect) {
      vw = rect.width;
      vh = rect.width / videoAspect;
      vx = rect.left;
      vy = rect.top + (rect.height - vh) / 2;
    } else {
      vh = rect.height;
      vw = rect.height * videoAspect;
      vx = rect.left + (rect.width - vw) / 2;
      vy = rect.top;
    }

    const x = (e.clientX - vx) / vw;
    const y = (e.clientY - vy) / vh;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  },

  _onMouseMove: null,
  _onMouseDown: null,
  _onMouseUp: null,
  _onWheel: null,
  _onContext: null,
  _onKeyDown: null,
  _onKeyUp: null,
  _onDragOver: null,
  _onDrop: null,

  attachInputListeners() {
    const container = document.getElementById('video-container');

    this._onMouseMove = (e) => {
      const pos = this.getNormalizedPosition(e);
      if (pos) WebRTCManager.sendInput({ type: 'mouse-move', ...pos });
    };

    this._onMouseDown = (e) => {
      e.preventDefault();
      const pos = this.getNormalizedPosition(e);
      if (pos) WebRTCManager.sendInput({ type: 'mouse-down', button: e.button, ...pos });
    };

    this._onMouseUp = (e) => {
      e.preventDefault();
      const pos = this.getNormalizedPosition(e);
      if (pos) WebRTCManager.sendInput({ type: 'mouse-up', button: e.button, ...pos });
    };

    this._onWheel = (e) => {
      e.preventDefault();
      WebRTCManager.sendInput({
        type: 'mouse-scroll',
        deltaX: Math.sign(e.deltaX),
        deltaY: Math.sign(e.deltaY),
      });
    };

    this._onContext = (e) => e.preventDefault();

    // Intercept Ctrl+C/V/X for seamless clipboard & file sync
    this._onKeyDown = async (e) => {
      // Don't intercept if typing in chat or notes
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();

      // Ctrl+V: sync clipboard to client, then send paste
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
        await ClipboardSync.syncToClient();
        // Brief delay for client to receive clipboard
        await new Promise(r => setTimeout(r, 50));
        WebRTCManager.sendInput({ type: 'key-down', keyCode: 'ControlLeft' });
        WebRTCManager.sendInput({ type: 'key-down', keyCode: 'KeyV' });
        setTimeout(() => {
          WebRTCManager.sendInput({ type: 'key-up', keyCode: 'KeyV' });
          WebRTCManager.sendInput({ type: 'key-up', keyCode: 'ControlLeft' });
        }, 50);
        return;
      }

      // Ctrl+C: send copy to client, then pull their clipboard
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
        WebRTCManager.sendInput({ type: 'key-down', keyCode: 'ControlLeft' });
        WebRTCManager.sendInput({ type: 'key-down', keyCode: 'KeyC' });
        setTimeout(() => {
          WebRTCManager.sendInput({ type: 'key-up', keyCode: 'KeyC' });
          WebRTCManager.sendInput({ type: 'key-up', keyCode: 'ControlLeft' });
          setTimeout(() => ClipboardSync.requestFromClient(), 100);
        }, 50);
        return;
      }

      // Ctrl+X: send cut to client, then pull their clipboard
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyX') {
        WebRTCManager.sendInput({ type: 'key-down', keyCode: 'ControlLeft' });
        WebRTCManager.sendInput({ type: 'key-down', keyCode: 'KeyX' });
        setTimeout(() => {
          WebRTCManager.sendInput({ type: 'key-up', keyCode: 'KeyX' });
          WebRTCManager.sendInput({ type: 'key-up', keyCode: 'ControlLeft' });
          setTimeout(() => ClipboardSync.requestFromClient(), 100);
        }, 50);
        return;
      }

      WebRTCManager.sendInput({ type: 'key-down', keyCode: e.code });
    };

    this._onKeyUp = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      // Skip key-up for keys we handled specially
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV' || e.code === 'KeyC' || e.code === 'KeyX')) return;
      WebRTCManager.sendInput({ type: 'key-up', keyCode: e.code });
    };

    // Drag-and-drop files to send to client
    this._onDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    this._onDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.files?.length > 0) {
        await FileTransfer.sendDroppedFiles(Array.from(e.dataTransfer.files));
      }
    };

    container.addEventListener('mousemove', this._onMouseMove);
    container.addEventListener('mousedown', this._onMouseDown);
    container.addEventListener('mouseup', this._onMouseUp);
    container.addEventListener('wheel', this._onWheel, { passive: false });
    container.addEventListener('contextmenu', this._onContext);
    container.addEventListener('dragover', this._onDragOver);
    container.addEventListener('drop', this._onDrop);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  },

  detachInputListeners() {
    const container = document.getElementById('video-container');
    if (this._onMouseMove) {
      container.removeEventListener('mousemove', this._onMouseMove);
      container.removeEventListener('mousedown', this._onMouseDown);
      container.removeEventListener('mouseup', this._onMouseUp);
      container.removeEventListener('wheel', this._onWheel);
      container.removeEventListener('contextmenu', this._onContext);
      container.removeEventListener('dragover', this._onDragOver);
      container.removeEventListener('drop', this._onDrop);
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
    }
  },
};
