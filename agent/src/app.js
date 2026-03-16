// Numbers10 Support Agent — Tauri version
// Uses Tauri APIs instead of Electron IPC

const SERVER_URL = 'https://remoteit.numbers10.co.za';

let socket = null;
let peerConnection = null;
let localStream = null;
let dataChannel = null;
let sessionCode = null;
let controlActive = false;
let clipboardPollInterval = null;
let lastClipboardText = '';
let captureCanvas = null;
let captureCtx = null;
let captureUnlisten = null;

// ── DOM Elements ──
const connectScreen = document.getElementById('connect-screen');
const sessionScreen = document.getElementById('session-screen');
const codeInput = document.getElementById('code-input');
const connectBtn = document.getElementById('connect-btn');
const createBtn = document.getElementById('create-btn');
const connectError = document.getElementById('connect-error');
const sessionCodeEl = document.getElementById('session-code');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const controlStatus = document.getElementById('control-status');
const controlText = document.getElementById('control-text');
const revokeBtn = document.getElementById('revoke-btn');
const endBtn = document.getElementById('end-btn');
const consentOverlay = document.getElementById('consent-overlay');
const consentTechName = document.getElementById('consent-tech-name');
const consentAllow = document.getElementById('consent-allow');
const consentDeny = document.getElementById('consent-deny');

// ── Screen Capture (native via Rust xcap — no browser picker) ──
async function startCapture() {
  captureCanvas = document.createElement('canvas');
  captureCtx = captureCanvas.getContext('2d');

  return new Promise((resolve, reject) => {
    let resolved = false;

    window.__TAURI__.event.listen('screen-frame', (event) => {
      const img = new Image();
      img.onload = () => {
        if (!resolved) {
          captureCanvas.width = img.naturalWidth;
          captureCanvas.height = img.naturalHeight;
          captureCtx.drawImage(img, 0, 0);
          localStream = captureCanvas.captureStream(15);
          resolved = true;
          resolve(localStream);
        }
        captureCtx.drawImage(img, 0, 0);
      };
      img.src = 'data:image/jpeg;base64,' + event.payload;
    }).then(fn => { captureUnlisten = fn; });

    window.__TAURI__.core.invoke('start_screen_capture').catch(reject);

    setTimeout(() => {
      if (!resolved) reject(new Error('Screen capture failed — no frames received'));
    }, 10000);
  });
}

// ── Clipboard Auto-Sync ──
function startClipboardPolling() {
  if (clipboardPollInterval) return;
  // Read initial clipboard
  window.__TAURI__.clipboardManager.readText().then(t => { lastClipboardText = t || ''; }).catch(() => {});

  clipboardPollInterval = setInterval(async () => {
    try {
      const text = await window.__TAURI__.clipboardManager.readText();
      if (text && text !== lastClipboardText) {
        lastClipboardText = text;
        if (dataChannel && dataChannel.readyState === 'open') {
          dataChannel.send(JSON.stringify({ type: 'clipboard-sync', text }));
        }
      }
    } catch {}
  }, 300);
}

function stopClipboardPolling() {
  if (clipboardPollInterval) {
    clearInterval(clipboardPollInterval);
    clipboardPollInterval = null;
  }
}

// ── Socket.IO Connection ──
async function connectToServer(code) {
  socket = io(SERVER_URL, {
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('Connected to signaling server');
    socket.emit('join', { role: 'client', sessionCode: code });
  });

  socket.on('joined', (data) => {
    console.log('Joined session, ICE servers:', data.iceServers);
    socket._iceServers = data.iceServers || [];
  });

  socket.on('peer-joined', async () => {
    console.log('Technician connected');
    statusIndicator.classList.add('connected');
    statusText.textContent = 'Technician connected — viewing your screen';
    await setupWebRTC();
  });

  socket.on('peer-left', () => {
    statusIndicator.classList.remove('connected');
    statusText.textContent = 'Technician disconnected';
    revokeControl();
  });

  socket.on('sdp-answer', async (data) => {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
  });

  socket.on('ice-candidate', async (data) => {
    if (peerConnection && data.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });

  socket.on('control-request', (data) => {
    consentTechName.textContent = data.technicianName || 'Technician';
    consentOverlay.classList.remove('hidden');
  });

  socket.on('error', (data) => {
    showError(data.message);
  });

  socket.on('disconnect', () => {
    statusIndicator.classList.remove('connected');
    statusText.textContent = 'Disconnected from server';
  });
}

// ── WebRTC ──
async function setupWebRTC() {
  const iceServers = socket._iceServers || [];
  const config = {
    iceServers: iceServers.length > 0 ? iceServers : [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  peerConnection = new RTCPeerConnection(config);

  if (!localStream) {
    await startCapture();
  }

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Receive data channel for input events from technician
  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    dataChannel.onmessage = async (msg) => {
      try {
        const inputEvent = JSON.parse(msg.data);

        if (inputEvent.type === 'control-request') {
          consentTechName.textContent = inputEvent.technicianName || 'Technician';
          consentOverlay.classList.remove('hidden');
          return;
        }

        if (inputEvent.type === 'control-response' || inputEvent.type === 'control-revoke') {
          return;
        }

        // Ctrl+Alt+Del (sends Ctrl+Shift+Esc to open Task Manager)
        if (inputEvent.type === 'send-sas') {
          window.__TAURI__.core.invoke('send_sas');
          return;
        }

        // Clipboard sync: technician sends their clipboard text — auto-write
        if (inputEvent.type === 'clipboard-sync') {
          lastClipboardText = inputEvent.text; // prevent re-sending
          await window.__TAURI__.clipboardManager.writeText(inputEvent.text);
          return;
        }

        // Clipboard request: technician wants our clipboard
        if (inputEvent.type === 'clipboard-request') {
          const text = await window.__TAURI__.clipboardManager.readText();
          if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify({ type: 'clipboard-sync', text: text || '' }));
          }
          return;
        }

        // File transfer: receive file from technician via Rust backend
        if (inputEvent.type === 'file-start') {
          window.__TAURI__.core.invoke('file_start', {
            data: { fileId: inputEvent.fileId, filename: inputEvent.filename, size: inputEvent.size }
          });
          return;
        }
        if (inputEvent.type === 'file-chunk') {
          window.__TAURI__.core.invoke('file_chunk', {
            data: { fileId: inputEvent.fileId, chunk: inputEvent.chunk }
          });
          return;
        }
        if (inputEvent.type === 'file-end') {
          window.__TAURI__.core.invoke('file_end', {
            data: { fileId: inputEvent.fileId }
          });
          return;
        }

        // Input events — forward to Rust for injection
        if (controlActive) {
          window.__TAURI__.core.invoke('handle_input_event', { event: inputEvent });
        }
      } catch (e) {
        console.error('Invalid input event:', e);
      }
    };

    // Start clipboard auto-sync when DataChannel is ready
    startClipboardPolling();
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { candidate: event.candidate, sessionCode });
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log('ICE state:', peerConnection.iceConnectionState);
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('sdp-offer', { sdp: peerConnection.localDescription, sessionCode });
}

// ── Control Flow ──
function grantControl() {
  controlActive = true;
  consentOverlay.classList.add('hidden');
  controlStatus.classList.remove('hidden');
  revokeBtn.classList.remove('hidden');
  window.__TAURI__.core.invoke('control_granted');

  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'control-response', granted: true }));
  }
  socket?.emit('control-response', { sessionCode, granted: true });
}

function denyControl() {
  consentOverlay.classList.add('hidden');
  window.__TAURI__.core.invoke('control_denied');

  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'control-response', granted: false }));
  }
  socket?.emit('control-response', { sessionCode, granted: false });
}

function revokeControl() {
  if (!controlActive) return;
  controlActive = false;
  controlStatus.classList.add('hidden');
  revokeBtn.classList.add('hidden');
  window.__TAURI__.core.invoke('control_revoke');

  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'control-revoke' }));
  }
  socket?.emit('control-revoke', { sessionCode, reason: 'client_initiated' });
}

function endSession() {
  controlActive = false;
  stopClipboardPolling();
  window.__TAURI__.core.invoke('session_ended');
  window.__TAURI__.core.invoke('stop_screen_capture').catch(() => {});

  if (captureUnlisten) {
    captureUnlisten();
    captureUnlisten = null;
  }
  captureCanvas = null;
  captureCtx = null;

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  sessionScreen.classList.remove('active');
  connectScreen.classList.add('active');
  controlStatus.classList.add('hidden');
  revokeBtn.classList.add('hidden');
  statusIndicator.classList.remove('connected');
  statusText.textContent = 'Waiting for technician to connect...';
}

// ── UI Helpers ──
function showError(msg) {
  connectError.textContent = msg;
  connectError.classList.remove('hidden');
  setTimeout(() => connectError.classList.add('hidden'), 5000);
}

function showSession(code) {
  sessionCode = code;
  const formatted = code.match(/.{1,2}/g)?.join(' ') || code;
  sessionCodeEl.textContent = formatted;
  connectScreen.classList.remove('active');
  sessionScreen.classList.add('active');
}

// ── Event Listeners ──

createBtn.addEventListener('click', async () => {
  createBtn.disabled = true;
  createBtn.textContent = 'Starting...';

  try {
    await startCapture();

    const res = await fetch(`${SERVER_URL}/api/sessions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create session');

    showSession(data.code);
    await connectToServer(data.code);
  } catch (err) {
    showError(err.message || 'Failed to start session');
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = 'Start Support Session';
  }
});

connectBtn.addEventListener('click', async () => {
  const code = codeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (code.length !== 6) {
    showError('Please enter a valid 6-character code');
    return;
  }

  connectBtn.disabled = true;
  connectBtn.textContent = 'Connecting...';

  try {
    await startCapture();
    showSession(code);
    await connectToServer(code);
  } catch (err) {
    showError(err.message || 'Failed to connect');
  } finally {
    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect';
  }
});

consentAllow.addEventListener('click', grantControl);
consentDeny.addEventListener('click', denyControl);
revokeBtn.addEventListener('click', revokeControl);
endBtn.addEventListener('click', endSession);

// Handle Ctrl+Shift+F12 revoke from Rust backend
window.__TAURI__.event.listen('control-revoked-local', () => {
  revokeControl();
});

// Handle toolbar revoke
window.__TAURI__.event.listen('toolbar-revoke-control', () => {
  revokeControl();
});

// Handle file received notification
window.__TAURI__.event.listen('file-received', (event) => {
  console.log('File received:', event.payload.filename, 'at', event.payload.path);
});

// Auto-uppercase code input
codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
});
