import { useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useWebRTC } from '../../hooks/useWebRTC';

interface Props {
  sessionCode: string;
  onPeerConnected: () => void;
  onPeerDisconnected: () => void;
  onSharingChange: (sharing: boolean) => void;
}

export default function ScreenShareButton({ sessionCode, onPeerConnected, onPeerDisconnected, onSharingChange }: Props) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { socket, connected, peerConnected, iceServers } = useSocket({
    sessionCode,
    role: 'client',
    enabled: !!localStream,
  });

  useWebRTC({
    socket,
    sessionCode,
    role: 'client',
    localStream,
    iceServers,
    peerConnected,
  });

  useEffect(() => {
    if (peerConnected) onPeerConnected();
    else onPeerDisconnected();
  }, [peerConnected, onPeerConnected, onPeerDisconnected]);

  const startSharing = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false,
      });

      stream.getVideoTracks()[0].onended = () => {
        setLocalStream(null);
        onSharingChange(false);
      };

      setLocalStream(stream);
      onSharingChange(true);
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setError('Failed to start screen sharing. Please try again.');
      }
    }
  };

  const stopSharing = () => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      onSharingChange(false);
    }
  };

  if (localStream) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 text-green-600 text-sm">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Screen sharing active
        </div>
        <button
          onClick={stopSharing}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          Stop Sharing
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Share your screen so the technician can see your issue</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={startSharing}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
      >
        Share Screen in Browser
      </button>
    </div>
  );
}
