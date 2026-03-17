import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useAuth } from '../../context/AuthContext';
import { endSessionApi, updateSessionNotes } from '../../api/sessions';
import ConnectionStatus from './ConnectionStatus';

const CHUNK_SIZE = 16384; // 16KB chunks for file transfer

interface ChatMsg {
  sender: 'client' | 'technician';
  text: string;
  timestamp: string;
}

interface SystemInfo {
  [key: string]: string;
}

const AVAILABLE_TAGS = ['#hardware', '#software', '#network', '#printer', '#email', '#security', '#account', '#other'];

export default function SessionViewer() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [controlRequested, setControlRequested] = useState(false);
  const [fileTransfer, setFileTransfer] = useState<{ name: string; progress: number } | null>(null);
  const lastClipboardRef = useRef<string>('');

  // Phase 3 state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [sysInfoOpen, setSysInfoOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionTags, setSessionTags] = useState<string[]>([]);
  const [notesSaving, setNotesSaving] = useState(false);

  const { socket, connected, peerConnected, iceServers, error } = useSocket({
    sessionCode: code || '',
    role: 'technician',
    enabled: !!code,
  });

  const { remoteStream, connectionState, sendInput, requestControl, controlGranted, dataChannel } = useWebRTC({
    socket,
    sessionCode: code || '',
    role: 'technician',
    iceServers,
    peerConnected,
  });

  // Listen for DataChannel messages: clipboard-sync, chat, system-info
  useEffect(() => {
    const dc = dataChannel.current;
    if (!dc) return;
    const origHandler = dc.onmessage;
    dc.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'clipboard-sync') {
          lastClipboardRef.current = data.text;
          navigator.clipboard.writeText(data.text).catch(() => {});
          return;
        }
        if (data.type === 'chat') {
          const chatMsg: ChatMsg = { sender: data.sender, text: data.text, timestamp: data.timestamp };
          setChatMessages(prev => [...prev, chatMsg]);
          if (!chatOpen) setChatUnread(prev => prev + 1);
          return;
        }
        if (data.type === 'system-info') {
          setSystemInfo(data.info);
          return;
        }
      } catch {}
      if (origHandler) origHandler.call(dc, msg);
    };
  }, [dataChannel.current, chatOpen]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleEndSession = async () => {
    // Save notes before ending
    if (sessionNotes || sessionTags.length > 0) {
      await updateSessionNotes(code!, sessionNotes, sessionTags).catch(() => {});
    }
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

  // Send chat message
  const sendChat = useCallback(() => {
    const text = chatInputRef.current?.value.trim();
    if (!text) return;

    const timestamp = new Date().toISOString();
    sendInput({ type: 'chat', sender: 'technician', text, timestamp });
    setChatMessages(prev => [...prev, { sender: 'technician', text, timestamp }]);
    chatInputRef.current!.value = '';
  }, [sendInput]);

  // Screenshot: capture current video frame as PNG
  const handleScreenshot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screenshot-${code}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [code]);

  // Request system info refresh
  const refreshSystemInfo = useCallback(() => {
    sendInput({ type: 'system-info-request' });
  }, [sendInput]);

  // Save notes
  const saveNotes = useCallback(async () => {
    if (!code) return;
    setNotesSaving(true);
    try {
      await updateSessionNotes(code, sessionNotes, sessionTags);
    } catch {}
    setNotesSaving(false);
  }, [code, sessionNotes, sessionTags]);

  const toggleTag = useCallback((tag: string) => {
    setSessionTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  // Send file to client via DataChannel
  const sendFileToClient = useCallback(async (file: File) => {
    const fileId = Math.random().toString(36).substring(2, 10);
    const totalSize = file.size;

    sendInput({ type: 'file-start', fileId, filename: file.name, size: totalSize });
    setFileTransfer({ name: file.name, progress: 0 });

    const reader = file.stream().getReader();
    let sent = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
          const chunk = value.slice(i, i + CHUNK_SIZE);
          const base64 = btoa(String.fromCharCode(...chunk));
          sendInput({ type: 'file-chunk', fileId, chunk: base64 });
          sent += chunk.length;
          setFileTransfer({ name: file.name, progress: Math.round((sent / totalSize) * 100) });
          await new Promise(r => setTimeout(r, 5));
        }
      }
      sendInput({ type: 'file-end', fileId });
    } finally {
      setFileTransfer(null);
    }
  }, [sendInput]);

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

  // Seamless clipboard & file sync: intercept Ctrl+C / Ctrl+V during control
  useEffect(() => {
    if (!controlGranted) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't intercept if typing in chat
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      e.preventDefault();

      // Ctrl+V: sync clipboard/files to client before pasting
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
        try {
          const items = await navigator.clipboard.read().catch(() => null);
          if (items) {
            for (const item of items) {
              for (const type of item.types) {
                if (type.startsWith('image/') || type === 'application/octet-stream') {
                  const blob = await item.getType(type);
                  const ext = type === 'image/png' ? '.png' : type === 'image/jpeg' ? '.jpg' : '.bin';
                  const file = new File([blob], `clipboard${ext}`, { type });
                  await sendFileToClient(file);
                }
              }
              if (item.types.includes('text/plain')) {
                const blob = await item.getType('text/plain');
                const text = await blob.text();
                if (text && text !== lastClipboardRef.current) {
                  lastClipboardRef.current = text;
                  sendInput({ type: 'clipboard-sync', text });
                  await new Promise(r => setTimeout(r, 50));
                }
              }
            }
          }
        } catch {
          try {
            const text = await navigator.clipboard.readText();
            if (text && text !== lastClipboardRef.current) {
              lastClipboardRef.current = text;
              sendInput({ type: 'clipboard-sync', text });
              await new Promise(r => setTimeout(r, 50));
            }
          } catch {}
        }
        sendInput({ type: 'key-down', keyCode: 'ControlLeft' });
        sendInput({ type: 'key-down', keyCode: 'KeyV' });
        setTimeout(() => {
          sendInput({ type: 'key-up', keyCode: 'KeyV' });
          sendInput({ type: 'key-up', keyCode: 'ControlLeft' });
        }, 50);
        return;
      }

      // Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
        sendInput({ type: 'key-down', keyCode: 'ControlLeft' });
        sendInput({ type: 'key-down', keyCode: 'KeyC' });
        setTimeout(() => {
          sendInput({ type: 'key-up', keyCode: 'KeyC' });
          sendInput({ type: 'key-up', keyCode: 'ControlLeft' });
          setTimeout(() => {
            sendInput({ type: 'clipboard-request' });
          }, 100);
        }, 50);
        return;
      }

      // Ctrl+X
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyX') {
        sendInput({ type: 'key-down', keyCode: 'ControlLeft' });
        sendInput({ type: 'key-down', keyCode: 'KeyX' });
        setTimeout(() => {
          sendInput({ type: 'key-up', keyCode: 'KeyX' });
          sendInput({ type: 'key-up', keyCode: 'ControlLeft' });
          setTimeout(() => {
            sendInput({ type: 'clipboard-request' });
          }, 100);
        }, 50);
        return;
      }

      sendInput({ type: 'key-down', keyCode: e.code });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV' || e.code === 'KeyC' || e.code === 'KeyX')) return;
      sendInput({ type: 'key-up', keyCode: e.code });
    };

    const handlePaste = async (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        for (const file of Array.from(files)) {
          await sendFileToClient(file);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('paste', handlePaste);
    };
  }, [controlGranted, sendInput, sendFileToClient]);

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const SYS_INFO_LABELS: Record<string, string> = {
    os: 'OS',
    hostname: 'Hostname',
    username: 'User',
    cpu: 'CPU',
    cores: 'Cores',
    ram_total: 'RAM Total',
    ram_used: 'RAM Used',
    ram_percent: 'RAM Usage',
    resolution: 'Resolution',
    uptime: 'Uptime',
    disk_total: 'Disk (C:)',
    disk_free: 'Disk Free',
  };

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

        <div className="flex items-center gap-2">
          {/* Screenshot */}
          {peerConnected && (
            <button
              onClick={handleScreenshot}
              title="Capture screenshot"
              className="bg-n10-surface hover:bg-n10-border text-n10-text-dim hover:text-n10-text px-3 py-1.5 rounded-lg text-sm transition-colors border border-n10-border"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </button>
          )}

          {/* System Info */}
          {peerConnected && (
            <button
              onClick={() => { setSysInfoOpen(!sysInfoOpen); setChatOpen(false); setNotesOpen(false); }}
              title="System info"
              className={`bg-n10-surface hover:bg-n10-border px-3 py-1.5 rounded-lg text-sm transition-colors border border-n10-border ${sysInfoOpen ? 'text-n10-primary' : 'text-n10-text-dim hover:text-n10-text'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </button>
          )}

          {/* Chat */}
          {peerConnected && (
            <button
              onClick={() => { setChatOpen(!chatOpen); setSysInfoOpen(false); setNotesOpen(false); if (!chatOpen) setChatUnread(0); }}
              title="Chat"
              className={`bg-n10-surface hover:bg-n10-border px-3 py-1.5 rounded-lg text-sm transition-colors border border-n10-border relative ${chatOpen ? 'text-n10-primary' : 'text-n10-text-dim hover:text-n10-text'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {chatUnread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-n10-danger rounded-full text-[10px] text-white flex items-center justify-center">
                  {chatUnread}
                </span>
              )}
            </button>
          )}

          {/* Notes */}
          {peerConnected && (
            <button
              onClick={() => { setNotesOpen(!notesOpen); setChatOpen(false); setSysInfoOpen(false); }}
              title="Session notes"
              className={`bg-n10-surface hover:bg-n10-border px-3 py-1.5 rounded-lg text-sm transition-colors border border-n10-border ${notesOpen ? 'text-n10-primary' : 'text-n10-text-dim hover:text-n10-text'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}

          <span className="text-n10-border">|</span>

          {peerConnected && controlGranted && (
            <button
              onClick={() => sendInput({ type: 'send-sas' })}
              title="Send Ctrl+Alt+Del to client (opens Task Manager)"
              className="bg-n10-surface hover:bg-n10-border text-n10-text-dim hover:text-n10-text px-3 py-1.5 rounded-lg text-sm transition-colors border border-n10-border flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Ctrl+Alt+Del
            </button>
          )}

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

      {/* File transfer progress bar */}
      {fileTransfer && (
        <div className="bg-n10-surface text-center py-1 text-xs font-medium shrink-0 flex items-center justify-center gap-4">
          <span className="text-n10-secondary flex items-center gap-2">
            Sending {fileTransfer.name}...
            <span className="inline-block w-24 h-1.5 bg-n10-border rounded-full overflow-hidden">
              <span className="block h-full bg-n10-primary rounded-full transition-all" style={{ width: `${fileTransfer.progress}%` }} />
            </span>
            {fileTransfer.progress}%
          </span>
        </div>
      )}

      {controlGranted && (
        <div className="bg-n10-danger text-white text-center py-1 text-xs font-semibold shrink-0">
          REMOTE CONTROL ACTIVE — Mouse and keyboard input is being sent to the client
        </div>
      )}

      {/* Main content: video + side panels */}
      <div className="flex-1 min-h-0 flex">
        {/* Video Area */}
        <div
          ref={videoContainerRef}
          className={`flex-1 min-w-0 flex items-center justify-center overflow-hidden ${controlGranted ? 'cursor-none' : ''}`}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
              for (const file of Array.from(files)) {
                await sendFileToClient(file);
              }
            }
          }}
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

        {/* Side Panel: Chat */}
        {chatOpen && (
          <div className="w-80 border-l border-n10-border bg-n10-mid flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-n10-border flex items-center justify-between">
              <span className="text-sm font-semibold text-n10-text">Chat</span>
              <button onClick={() => setChatOpen(false)} className="text-n10-text-dim hover:text-n10-text text-lg">&times;</button>
            </div>
            <div ref={chatMessagesRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-n10-text-dim text-xs text-center mt-4">No messages yet</p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.sender === 'technician' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                    msg.sender === 'technician'
                      ? 'bg-n10-primary text-white'
                      : 'bg-n10-surface text-n10-text'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-n10-text-dim mt-1">{formatTime(msg.timestamp)}</span>
                </div>
              ))}
            </div>
            <div className="px-3 py-3 border-t border-n10-border flex gap-2">
              <input
                ref={chatInputRef}
                type="text"
                placeholder="Type a message..."
                className="flex-1 min-w-0 bg-n10-surface border border-n10-border rounded-lg px-3 py-2 text-sm text-n10-text outline-none focus:border-n10-primary"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); sendChat(); } }}
              />
              <button
                onClick={sendChat}
                className="bg-n10-primary hover:bg-n10-primary/80 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Side Panel: System Info */}
        {sysInfoOpen && (
          <div className="w-80 border-l border-n10-border bg-n10-mid flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-n10-border flex items-center justify-between">
              <span className="text-sm font-semibold text-n10-text">System Info</span>
              <div className="flex items-center gap-2">
                <button onClick={refreshSystemInfo} className="text-n10-text-dim hover:text-n10-primary text-xs" title="Refresh">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button onClick={() => setSysInfoOpen(false)} className="text-n10-text-dim hover:text-n10-text text-lg">&times;</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {systemInfo ? (
                <div className="space-y-2">
                  {Object.entries(SYS_INFO_LABELS).map(([key, label]) => {
                    const val = systemInfo[key];
                    if (!val) return null;
                    return (
                      <div key={key} className="flex justify-between text-xs py-1.5 border-b border-n10-border/50">
                        <span className="text-n10-text-dim">{label}</span>
                        <span className="text-n10-text font-mono text-right max-w-[55%] truncate" title={val}>{val}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-n10-text-dim text-xs text-center mt-4">
                  Waiting for client system info...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Side Panel: Notes & Tags */}
        {notesOpen && (
          <div className="w-80 border-l border-n10-border bg-n10-mid flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-n10-border flex items-center justify-between">
              <span className="text-sm font-semibold text-n10-text">Session Notes</span>
              <button onClick={() => setNotesOpen(false)} className="text-n10-text-dim hover:text-n10-text text-lg">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
              <div>
                <label className="text-xs text-n10-text-dim block mb-2">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_TAGS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        sessionTags.includes(tag)
                          ? 'bg-n10-primary text-white'
                          : 'bg-n10-surface text-n10-text-dim hover:bg-n10-border'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 flex flex-col">
                <label className="text-xs text-n10-text-dim block mb-2">Notes</label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Session notes..."
                  className="flex-1 min-h-[120px] bg-n10-surface border border-n10-border rounded-lg px-3 py-2 text-sm text-n10-text outline-none focus:border-n10-primary resize-none"
                />
              </div>
              <button
                onClick={saveNotes}
                disabled={notesSaving}
                className="bg-n10-primary hover:bg-n10-primary/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {notesSaving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
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
