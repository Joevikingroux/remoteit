import { useState, useEffect } from 'react';

interface Props {
  connected: boolean;
  peerConnected: boolean;
  connectionState: string;
  code: string;
}

export default function ConnectionStatus({ connected, peerConnected, connectionState, code }: Props) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!peerConnected) {
      setDuration(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [peerConnected]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const connType = connectionState === 'connected' ? 'Connected' :
    connectionState === 'checking' ? 'Connecting...' :
    connectionState === 'failed' ? 'Failed' : connectionState;

  return (
    <div className="bg-gray-800 text-gray-400 px-4 py-2 flex items-center justify-between text-xs border-t border-gray-700">
      <div className="flex items-center gap-4">
        <span>Session: <span className="text-gray-300 font-mono">{code}</span></span>
        <span>Signal: {connected ? <span className="text-green-400">Connected</span> : <span className="text-red-400">Disconnected</span>}</span>
        <span>WebRTC: <span className="text-gray-300">{connType}</span></span>
      </div>
      <div className="flex items-center gap-4">
        <span>Mode: <span className="text-blue-400">View Only</span></span>
        {peerConnected && <span>Duration: <span className="text-gray-300 font-mono">{formatDuration(duration)}</span></span>}
      </div>
    </div>
  );
}
