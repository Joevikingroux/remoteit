import { useEffect, useRef, useState, MutableRefObject } from 'react';
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
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<string>('new');

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

    sock.on('sdp-offer', handleOffer);
    sock.on('sdp-answer', handleAnswer);
    sock.on('ice-candidate', handleIceCandidate);

    return () => {
      sock.off('sdp-offer', handleOffer);
      sock.off('sdp-answer', handleAnswer);
      sock.off('ice-candidate', handleIceCandidate);
      pc.close();
      pcRef.current = null;
    };
  }, [peerConnected, localStream, iceServers, role, sessionCode, socket]);

  return { remoteStream, connectionState, peerConnection: pcRef };
}
