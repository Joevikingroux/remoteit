import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../layout/Navbar';
import ActiveSessionCard from './ActiveSessionCard';
import { getActiveSessions, Session } from '../../api/admin';

export default function ActiveSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchSessions = async () => {
    try {
      const data = await getActiveSessions();
      setSessions(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number | null) => {
    if (seconds == null) return undefined;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-n10-bg flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        <h2 className="text-xl font-bold text-n10-text mb-4">Active Sessions</h2>

        {loading ? (
          <div className="text-n10-text-dim text-center py-12">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="bg-n10-mid rounded-xl border border-n10-border p-12 text-center text-n10-text-dim">
            No active sessions
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <ActiveSessionCard
                key={session.id}
                code={session.code}
                status={session.status}
                clientIp={session.client_ip || undefined}
                duration={formatDuration(session.duration_seconds)}
                onClick={() => navigate(`/dashboard/session/${session.code}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
