// Socket.IO connection manager
const SocketManager = {
  socket: null,
  connected: false,
  peerConnected: false,
  iceServers: [],
  onPeerJoined: null,
  onPeerLeft: null,
  onError: null,

  connect(sessionCode) {
    this.disconnect();

    this.socket = io('https://remoteit.numbers10.co.za', {
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.socket.emit('join', { role: 'technician', sessionCode });
      console.log('Connected to signaling server');
    });

    this.socket.on('joined', (data) => {
      this.iceServers = data.iceServers || [];
      console.log('Joined session, ICE servers:', this.iceServers);
    });

    this.socket.on('peer-joined', () => {
      this.peerConnected = true;
      if (this.onPeerJoined) this.onPeerJoined();
    });

    this.socket.on('peer-left', () => {
      this.peerConnected = false;
      if (this.onPeerLeft) this.onPeerLeft();
    });

    this.socket.on('error', (data) => {
      if (this.onError) this.onError(data.message);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
    });

    return this.socket;
  },

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.peerConnected = false;
    this.iceServers = [];
  },

  emit(event, data) {
    if (this.socket) this.socket.emit(event, data);
  },

  on(event, handler) {
    if (this.socket) this.socket.on(event, handler);
  },

  off(event, handler) {
    if (this.socket) this.socket.off(event, handler);
  },
};
