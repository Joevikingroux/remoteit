import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useAuth } from '../../context/AuthContext';
import { endSessionApi } from '../../api/sessions';
import ConnectionStatus from './ConnectionStatus';

export default function SessionViewer() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [controlRequested, setControlRequested] = useState(false);

  const { socket, connected, peerConnected, iceServers, error } = useSocket({
    sessionCode: code || '',
    role: 'technician',
    enabled: !!code,
  });

  const { remoteStream, connectionState, sendInput, requestControl, controlGranted } = useWebRTC({
    socket,
    sessionCode: code || '',
    role: 'technician',
    iceServers,
    peerConnected,
  });

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (controlGranted || !controlRequested) return;
  }, [controlGranted, controlRequested]);

  const handleEndSession = async () => {
    if (code) {
      await endSessionApi(code).catch(() => {});
    }
    navigate('/dashboard');
  };

  const handleRequestControl = () => {
    requestControl(user?.name || 'Technician');
    setControlRequested(true);
  };

  const handleReleaseControl = () => {
    socket.current?.emit('control-revoke', { sessionCode: code, reason: 'technician_released' });
    setControlRequested(false);
  };

  const getNormalizedPosition = useCallback((e: React.MouseEvent) => {
    const video = videoRef.current;
    if (!video) return null;

    const rect = video.getBoundingClientRect();
    const videoAspect = video.videoWidth / video.videoHeight;
    const elemAspect = rect.width / rect.height;

    let videoX, videoY, videoW, videoH;
    if (videoAspect > elemAspect) {
      videoW = rect.width;
      videoH = rect.width / videoAspect;
      videoX = rect.left;
      videoY = rect.top + (rect.height - videoH) / 2;
    } else {
      videoH = rect.height;
      videoW = rect.height * videoAspect;
      videoX = rect.left + (rect.width - videoW) / 2;
      videoY = rect.top;
    }

    const x = (e.clientX - videoX) / videoW;
    const y = (e.clientY - videoY) / videoH;

    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!controlGranted) return;
    const pos = getNormalizedPosition(e);
    if (pos) sendInput({ type: 'mouse-move', ...pos });
  }, [controlGranted, getNormalizedPosition, sendInput]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!controlGranted) return;
    e.preventDefault();
    const pos = getNormalizedPosition(e);
    if (pos) sendInput({ type: 'mouse-down', button: e.button, ...pos });
  }, [controlGranted, getNormalizedPosition, sendInput]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!controlGranted) return;
    e.preventDefault();
    const pos = getNormalizedPosition(e);
    if (pos) sendInput({ type: 'mouse-up', button: e.button, ...pos });
  }, [controlGranted, getNormalizedPosition, sendInput]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!controlGranted) return;
    e.preventDefault();
    sendInput({
      type: 'mouse-scroll',
      deltaX: Math.sign(e.deltaX),
      deltaY: Math.sign(e.deltaY),
    });
  }, [controlGranted, sendInput]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (controlGranted) e.preventDefault();
  }, [controlGranted]);

  useEffect(() => {
    if (!controlGranted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      sendInput({ type: 'key-down', keyCode: e.code });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      sendInput({ type: 'key-up', keyCode: e.code });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [controlGranted, sendInput]);

  return (
    <div className="h-screen flex flex-col bg-n10-bg">
      {/* Toolbar */}
      <div className="bg-n10-mid border-b border-n10-border text-n10-text px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-n10-text-dim hover:text-n10-text transition-colors flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <span className="text-n10-border">|</span>
          <span className="font-mono text-sm text-n10-text-dim">Session: {code}</span>
        </div>

        <div className="flex items-center gap-3">
          {peerConnected && (
            controlGranted ? (
              <button
                onClick={handleReleaseControl}
                className="bg-n10-danger hover:bg-n10-danger/80 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Release Control
              </button>
            ) : (
              <button
                onClick={handleRequestControl}
                disabled={controlRequested}
                className="bg-n10-warning hover:bg-n10-warning/80 text-n10-bg px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {controlRequested ? 'Waiting for approval...' : 'Request Control'}
              </button>
            )
          )}

          {peerConnected ? (
            <span className="flex items-center gap-2 text-n10-success text-sm">
              <span className="w-2 h-2 bg-n10-success rounded-full" />
              Client Connected
            </span>
          ) : (
            <span className="flex items-center gap-2 text-n10-warning text-sm">
              <span className="w-2 h-2 bg-n10-warning rounded-full animate-pulse" />
              Waiting for client...
            </span>
          )}

          <button
            onClick={handleEndSession}
            className="bg-n10-danger hover:bg-n10-danger/80 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            End Session
          </button>
        </div>
      </div>

      {controlGranted && (
        <div className="bg-n10-danger text-white text-center py-1 text-xs font-semibold shrink-0">
          REMOTE CONTROL ACTIVE — Mouse and keyboard input is being sent to the client
        </div>
      )}

      {/* Video Area */}
      <div
        ref={videoContainerRef}
        className={`flex-1 min-h-0 flex items-center justify-center overflow-hidden ${controlGranted ? 'cursor-none' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        tabIndex={0}
      >
        {remoteStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-center text-n10-text-dim">
            {error ? (
              <p className="text-n10-danger">{error}</p>
            ) : peerConnected ? (
              <div>
                <div className="animate-spin w-8 h-8 border-2 border-n10-surface border-t-n10-primary rounded-full mx-auto mb-4" />
                <p>Establishing video connection...</p>
              </div>
            ) : (
              <div>
                <svg className="w-24 h-24 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p>Waiting for client to share their screen...</p>
                <p className="text-sm mt-2 text-n10-text-dim/60">
                  The client needs to click "Share Screen" or use the desktop agent
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <ConnectionStatus
        connected={connected}
        peerConnected={peerConnected}
        connectionState={connectionState}
        code={code || ''}
        controlActive={controlGranted}
      />
    </div>
  );
}
