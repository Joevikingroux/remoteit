// WebRTC peer connection manager (technician role)
const WebRTCManager = {
  pc: null,
  dataChannel: null,
  remoteStream: null,
  controlGranted: false,
  onRemoteStream: null,
  onConnectionState: null,
  onControlChanged: null,

  setup(sessionCode) {
    const servers = SocketManager.iceServers;
    const pc = new RTCPeerConnection({
      iceServers: servers.length > 0 ? servers : [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.pc = pc;

    pc.oniceconnectionstatechange = () => {
      if (this.onConnectionState) this.onConnectionState(pc.iceConnectionState);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        SocketManager.emit('ice-candidate', { candidate: event.candidate, sessionCode });
      }
    };

    pc.ontrack = (event) => {
      this.remoteStream = event.streams[0] || new MediaStream([event.track]);
      if (this.onRemoteStream) this.onRemoteStream(this.remoteStream);
    };

    // Receive DataChannel from agent (agent is the offerer, so it creates the DC)
    pc.ondatachannel = (event) => {
      console.log('Technician received DataChannel from agent');
      this.dataChannel = event.channel;
      this.dataChannel.onopen = () => console.log('DataChannel open');
      this.dataChannel.onclose = () => console.log('DataChannel closed');
      this.dataChannel.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === 'control-response') {
            this.controlGranted = data.granted;
            if (this.onControlChanged) this.onControlChanged(data.granted);
          } else if (data.type === 'control-revoke') {
            this.controlGranted = false;
            if (this.onControlChanged) this.onControlChanged(false);
          } else if (data.type === 'clipboard-sync') {
            ClipboardSync.onReceived(data.text);
          }
        } catch {}
      };
    };

    // Socket signaling handlers
    const handleOffer = async (data) => {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      SocketManager.emit('sdp-answer', { sdp: pc.localDescription, sessionCode });
    };

    const handleIce = async (data) => {
      if (data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };

    const handleControlResponse = (data) => {
      this.controlGranted = data.granted;
      if (this.onControlChanged) this.onControlChanged(data.granted);
    };

    const handleControlRevoke = () => {
      this.controlGranted = false;
      if (this.onControlChanged) this.onControlChanged(false);
    };

    SocketManager.on('sdp-offer', handleOffer);
    SocketManager.on('ice-candidate', handleIce);
    SocketManager.on('control-response', handleControlResponse);
    SocketManager.on('control-revoke', handleControlRevoke);

    this._cleanup = () => {
      SocketManager.off('sdp-offer', handleOffer);
      SocketManager.off('ice-candidate', handleIce);
      SocketManager.off('control-response', handleControlResponse);
      SocketManager.off('control-revoke', handleControlRevoke);
    };
  },

  sendInput(event) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event));
    }
  },

  requestControl(technicianName, sessionCode) {
    SocketManager.emit('control-request', { sessionCode, technicianName });
    this.sendInput({ type: 'control-request', technicianName });
  },

  releaseControl(sessionCode) {
    SocketManager.emit('control-revoke', { sessionCode, reason: 'technician_released' });
    this.controlGranted = false;
    if (this.onControlChanged) this.onControlChanged(false);
  },

  close() {
    if (this._cleanup) this._cleanup();
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream = null;
    this.controlGranted = false;
  },
};
