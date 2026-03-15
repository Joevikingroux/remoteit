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
      // May already be claimed or in progress, continue anyway
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
    document.getElementById('clipboard-buttons').classList.add('hidden');
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
    document.getElementById('clipboard-buttons').classList.remove('hidden');
    document.getElementById('control-btn').classList.remove('hidden');

    // Setup WebRTC
    WebRTCManager.onRemoteStream = (stream) => this.onRemoteStream(stream);
    WebRTCManager.onConnectionState = (state) => this.onConnectionState(state);
    WebRTCManager.onControlChanged = (granted) => this.onControlChanged(granted);
    WebRTCManager.setup(this.sessionCode);
  },

  onPeerLeft() {
    document.getElementById('peer-status').className = 'status-badge waiting';
    document.getElementById('peer-status').innerHTML = '<span class="status-dot"></span> Client Disconnected';
    document.getElementById('clipboard-buttons').classList.add('hidden');
    document.getElementById('control-btn').classList.add('hidden');
    this.onControlChanged(false);
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

    if (granted) {
      controlBtn.classList.add('hidden');
      releaseBtn.classList.remove('hidden');
      controlBar.classList.remove('hidden');
      videoArea.classList.add('control-active');
      this.attachInputListeners();
      // Show native toolbar
      window.__TAURI__?.core?.invoke('create_toolbar').catch(() => {});
    } else {
      controlBtn.classList.remove('hidden');
      releaseBtn.classList.add('hidden');
      controlBar.classList.add('hidden');
      videoArea.classList.remove('control-active');
      controlBtn.textContent = 'Request Control';
      controlBtn.disabled = false;
      this.controlRequested = false;
      this.detachInputListeners();
      // Hide native toolbar
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

  async endSession() {
    try {
      await apiFetch(`/sessions/${this.sessionCode}/end`, { method: 'POST' }).catch(() => {});
    } catch {}
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

    this._onKeyDown = (e) => {
      e.preventDefault();
      WebRTCManager.sendInput({ type: 'key-down', keyCode: e.code });
    };

    this._onKeyUp = (e) => {
      e.preventDefault();
      WebRTCManager.sendInput({ type: 'key-up', keyCode: e.code });
    };

    container.addEventListener('mousemove', this._onMouseMove);
    container.addEventListener('mousedown', this._onMouseDown);
    container.addEventListener('mouseup', this._onMouseUp);
    container.addEventListener('wheel', this._onWheel, { passive: false });
    container.addEventListener('contextmenu', this._onContext);
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
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
    }
  },
};
