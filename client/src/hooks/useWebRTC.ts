import { useEffect, useRef, useState, useCallback, MutableRefObject } from 'react';
import { Socket } from 'socket.io-client';

interface UseWebRTCOptions {
  socket: MutableRefObject<Socket | null>;
  sessionCode: string;
  role: 'client' | 'technician';
  localStream?: MediaStream | null;
  iceServers: RTCIceServer[];
  peerConnected: boolean;
}

export function useWebRTC({
  socket,
  sessionCode,
  role,
  localStream,
  iceServers,
  peerConnected,
}: UseWebRTCOptions) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<string>('new');
  const [controlGranted, setControlGranted] = useState(false);

  useEffect(() => {
    const sock = socket.current;
    if (!sock || !peerConnected) return;

    const pc = new RTCPeerConnection({
      iceServers: iceServers.length > 0 ? iceServers : [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    pc.oniceconnectionstatechange = () => {
      setConnectionState(pc.iceConnectionState);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sock.emit('ice-candidate', { candidate: event.candidate, sessionCode });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0] || new MediaStream([event.track]));
    };

    // Technician creates DataChannel for sending input events
    if (role === 'technician') {
      const dc = pc.createDataChannel('input', { ordered: true });
      dataChannelRef.current = dc;

      dc.onopen = () => console.log('DataChannel open');
      dc.onclose = () => console.log('DataChannel closed');
      dc.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === 'control-response') {
            setControlGranted(data.granted);
          } else if (data.type === 'control-revoke') {
            setControlGranted(false);
          }
        } catch {}
      };
    }

    // Client receives DataChannel
    if (role === 'client') {
      pc.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
      };
    }

    // Client sends the offer (they have the media stream)
    if (role === 'client' && localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          sock.emit('sdp-offer', { sdp: pc.localDescription, sessionCode });
        });
    }

    // Socket handlers for signaling
    const handleOffer = async (data: { sdp: RTCSessionDescriptionInit }) => {
      if (role !== 'technician') return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sock.emit('sdp-answer', { sdp: pc.localDescription, sessionCode });
    };

    const handleAnswer = async (data: { sdp: RTCSessionDescriptionInit }) => {
      if (role !== 'client') return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    };

    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      if (data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };

    // Control flow via signaling (fallback)
    const handleControlResponse = (data: { granted: boolean }) => {
      setControlGranted(data.granted);
    };

    const handleControlRevoke = () => {
      setControlGranted(false);
    };

    sock.on('sdp-offer', handleOffer);
    sock.on('sdp-answer', handleAnswer);
    sock.on('ice-candidate', handleIceCandidate);
    sock.on('control-response', handleControlResponse);
    sock.on('control-revoke', handleControlRevoke);

    return () => {
      sock.off('sdp-offer', handleOffer);
      sock.off('sdp-answer', handleAnswer);
      sock.off('ice-candidate', handleIceCandidate);
      sock.off('control-response', handleControlResponse);
      sock.off('control-revoke', handleControlRevoke);
      pc.close();
      pcRef.current = null;
      dataChannelRef.current = null;
    };
  }, [peerConnected, localStream, iceServers, role, sessionCode, socket]);

  const sendInput = useCallback((event: Record<string, unknown>) => {
    const dc = dataChannelRef.current;
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify(event));
    }
  }, []);

  const requestControl = useCallback((technicianName: string) => {
    const sock = socket.current;
    if (sock) {
      sock.emit('control-request', { sessionCode, technicianName });
    }
    sendInput({ type: 'control-request', technicianName });
  }, [socket, sessionCode, sendInput]);

  return {
    remoteStream,
    connectionState,
    peerConnection: pcRef,
    dataChannel: dataChannelRef,
    sendInput,
    requestControl,
    controlGranted,
  };
}
