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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">IT</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Numbers10 IT Support</h1>
            <p className="text-sm text-gray-500">Remote support powered by RemoteIT</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center">
          {!session ? (
            <>
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Need IT Help?</h2>
              <p className="text-gray-600 mb-8">
                Click below to start a remote support session. A technician will be able to view your screen to help resolve your issue.
              </p>
              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}
              <button
                onClick={handleGetSupport}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating session...' : 'Get Remote Support'}
              </button>
            </>
          ) : expired ? (
            <>
              <div className="text-red-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Session Expired</h3>
              <p className="text-gray-600 mb-6">Your session code has expired. Please start a new session.</p>
              <button
                onClick={() => { setSession(null); setExpired(false); }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Start New Session
              </button>
            </>
          ) : (
            <>
              <SessionCodeDisplay code={session.code} />
              <p className="text-gray-600 mt-4 mb-2">Share this code with your technician</p>
              <CountdownTimer expiresAt={session.expiresAt} onExpired={() => setExpired(true)} />
              <StatusIndicator connected={peerConnected} sharing={sharing} />

              <div className="mt-6 border-t pt-6 space-y-4">
                <p className="text-sm font-medium text-gray-700">Choose how to connect:</p>

                {/* Option A: Browser screen share (view only) */}
                <ScreenShareButton
                  sessionCode={session.code}
                  onPeerConnected={() => setPeerConnected(true)}
                  onPeerDisconnected={() => setPeerConnected(false)}
                  onSharingChange={setSharing}
                />

                <div className="flex items-center gap-3 text-gray-400 text-xs">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span>or for full remote control</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Option B: Download desktop agent */}
                <a
                  href="/downloads/RemoteIT-Support.exe"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Support App (Windows)
                </a>
                <p className="text-xs text-gray-400">
                  Portable app — no installation needed. Enables full remote control.
                  <br />Your session code: <span className="font-mono font-semibold">{session.code}</span> — enter it in the app after launching.
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="text-center text-sm text-gray-400 py-4">
        Secured with end-to-end encryption
      </footer>
    </div>
  );
}
