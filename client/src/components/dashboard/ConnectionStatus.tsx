import { useState, useEffect } from 'react';

interface Props {
  connected: boolean;
  peerConnected: boolean;
  connectionState: string;
  code: string;
  controlActive?: boolean;
}

export default function ConnectionStatus({ connected, peerConnected, connectionState, code, controlActive }: Props) {
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
    <div className="bg-n10-mid text-n10-text-dim px-4 py-2 flex items-center justify-between text-xs border-t border-n10-border shrink-0">
      <div className="flex items-center gap-4">
        <span>Session: <span className="text-n10-text font-mono">{code}</span></span>
        <span>Signal: {connected ? <span className="text-n10-success">Connected</span> : <span className="text-n10-danger">Disconnected</span>}</span>
        <span>WebRTC: <span className="text-n10-text">{connType}</span></span>
      </div>
      <div className="flex items-center gap-4">
        <span>Mode: {controlActive ? <span className="text-n10-danger">Remote Control</span> : <span className="text-n10-primary">View Only</span>}</span>
        {peerConnected && <span>Duration: <span className="text-n10-text font-mono">{formatDuration(duration)}</span></span>}
      </div>
    </div>
  );
}
