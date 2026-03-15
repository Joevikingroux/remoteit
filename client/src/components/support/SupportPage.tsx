import { useState } from 'react';
import { createSession } from '../../api/sessions';
import SessionCodeDisplay from './SessionCodeDisplay';
import CountdownTimer from './CountdownTimer';
import StatusIndicator from './StatusIndicator';
import ScreenShareButton from './ScreenShareButton';

export default function SupportPage() {
  const [session, setSession] = useState<{ id: string; code: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleGetSupport = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createSession();
      setSession(result);
      setExpired(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-n10-bg flex flex-col">
      <header className="bg-n10-mid border-b border-n10-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/logo.png" alt="Numbers10" className="h-10 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-n10-text">Numbers10</h1>
            <p className="text-sm text-n10-text-dim">Technology Solutions</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-n10-mid rounded-2xl border border-n10-border max-w-lg w-full p-8 text-center">
          {!session ? (
            <>
              <div className="w-20 h-20 bg-n10-surface rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-n10-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-n10-text mb-2">Need IT Help?</h2>
              <p className="text-n10-text-dim mb-8">
                Click below to start a remote support session. A technician will be able to view your screen to help resolve your issue.
              </p>
              {error && (
                <div className="bg-n10-danger/10 text-n10-danger px-4 py-3 rounded-xl mb-4 text-sm border border-n10-danger/20">
                  {error}
                </div>
              )}
              <button
                onClick={handleGetSupport}
                disabled={loading}
                className="w-full btn-gradient text-white font-semibold py-4 px-6 rounded-xl text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating session...' : 'Get Remote Support'}
              </button>
            </>
          ) : expired ? (
            <>
              <div className="text-n10-danger mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-n10-text mb-2">Session Expired</h3>
              <p className="text-n10-text-dim mb-6">Your session code has expired. Please start a new session.</p>
              <button
                onClick={() => { setSession(null); setExpired(false); }}
                className="btn-gradient text-white font-semibold py-3 px-6 rounded-xl transition-all"
              >
                Start New Session
              </button>
            </>
          ) : (
            <>
              <SessionCodeDisplay code={session.code} />
              <p className="text-n10-text-dim mt-4 mb-2">Share this code with your technician</p>
              <CountdownTimer expiresAt={session.expiresAt} onExpired={() => setExpired(true)} />
              <StatusIndicator connected={peerConnected} sharing={sharing} />

              <div className="mt-6 border-t border-n10-border pt-6 space-y-4">
                <p className="text-sm font-medium text-n10-text-dim">Choose how to connect:</p>

                <ScreenShareButton
                  sessionCode={session.code}
                  onPeerConnected={() => setPeerConnected(true)}
                  onPeerDisconnected={() => setPeerConnected(false)}
                  onSharingChange={setSharing}
                />

                <div className="flex items-center gap-3 text-n10-text-dim text-xs">
                  <div className="flex-1 h-px bg-n10-border" />
                  <span>or for full remote control</span>
                  <div className="flex-1 h-px bg-n10-border" />
                </div>

                <a
                  href="/downloads/RemoteIT-Support.exe"
                  className="w-full bg-n10-surface hover:bg-n10-border text-n10-text font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 border border-n10-border"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Support App (Windows)
                </a>
                <p className="text-xs text-n10-text-dim">
                  Portable app — no installation needed. Enables full remote control.
                  <br />Your session code: <span className="font-mono font-semibold text-n10-primary">{session.code}</span> — enter it in the app after launching.
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="text-center text-sm text-n10-text-dim py-4">
        Secured with end-to-end encryption
      </footer>
    </div>
  );
}
