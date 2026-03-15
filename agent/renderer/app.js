// socket.io is loaded globally via CDN script tag (window.io)

let socket = null;
let peerConnection = null;
let localStream = null;
let dataChannel = null;
let sessionCode = null;
let controlActive = false;

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

// ── Screen Capture ──
async function startCapture() {
  try {
    const sources = await window.agent.getSources();
    if (sources.length === 0) throw new Error('No screen sources found');

    const sourceId = sources[0].id;

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          maxFrameRate: 30,
        },
      },
    });

    return localStream;
  } catch (err) {
    console.error('Screen capture failed:', err);
    throw err;
  }
}

// ── Socket.IO Connection ──
async function connectToServer(code) {
  const serverUrl = await window.agent.getServerUrl();

  socket = io(serverUrl, {
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
    dataChannel.onmessage = (msg) => {
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

        if (controlActive) {
          window.agent.sendInputEvent(inputEvent);
        }
      } catch (e) {
        console.error('Invalid input event:', e);
      }
    };
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
  window.agent.controlGranted();

  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'control-response', granted: true }));
  }
  socket?.emit('control-response', { sessionCode, granted: true });
}

function denyControl() {
  consentOverlay.classList.add('hidden');
  window.agent.controlDenied();

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
  window.agent.controlRevoke();

  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'control-revoke' }));
  }
  socket?.emit('control-revoke', { sessionCode, reason: 'client_initiated' });
}

function endSession() {
  controlActive = false;
  window.agent.sessionEnded();

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

// Main button: Create session + start capture
createBtn.addEventListener('click', async () => {
  createBtn.disabled = true;
  createBtn.textContent = 'Starting...';

  try {
    // First capture screen (needs user gesture in Electron)
    await startCapture();

    // Then create session on server
    const serverUrl = await window.agent.getServerUrl();
    const res = await fetch(`${serverUrl}/api/sessions/create`, {
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

// Secondary: Enter existing code
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

// Handle Ctrl+Shift+F12 revoke from main process
window.agent.onControlRevokedLocal(() => {
  revokeControl();
});

// Auto-uppercase code input
codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
});
