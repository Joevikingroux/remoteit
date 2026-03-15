import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  sessionCode: string;
  role: 'client' | 'technician';
  enabled?: boolean;
}

export function useSocket({ sessionCode, role, enabled = true }: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !sessionCode) return;

    const socket = io({
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { role, sessionCode });
    });

    socket.on('joined', (data: { iceServers: RTCIceServer[] }) => {
      setIceServers(data.iceServers || []);
    });

    socket.on('peer-joined', () => {
      setPeerConnected(true);
    });

    socket.on('peer-left', () => {
      setPeerConnected(false);
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionCode, role, enabled]);

  return { socket: socketRef, connected, peerConnected, iceServers, error };
}
