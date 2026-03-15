import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../layout/Navbar';
import CodeEntryForm from './CodeEntryForm';
import ActiveSessionCard from './ActiveSessionCard';
import { claimSession } from '../../api/sessions';
import { getStats, getActiveSessions, DashboardStats, Session } from '../../api/admin';

export default function DashboardPage() {
  const [error, setError] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [statsData, sessionsData] = await Promise.all([
        getStats(),
        getActiveSessions(),
      ]);
      setStats(statsData);
      setSessions(sessionsData);
    } catch {
      // silently fail on refresh
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async (code: string) => {
    setError('');
    try {
      await claimSession(code);
      navigate(`/dashboard/session/${code.toUpperCase()}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds == null) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-n10-bg flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-n10-mid rounded-xl border border-n10-border p-6 text-center">
            <div className="text-3xl font-bold text-n10-primary">
              {stats?.activeSessions ?? '-'}
            </div>
            <div className="text-sm text-n10-text-dim mt-1">Active Sessions</div>
          </div>
          <div className="bg-n10-mid rounded-xl border border-n10-border p-6 text-center">
            <div className="text-3xl font-bold text-n10-success">
              {stats?.todayTotal ?? '-'}
            </div>
            <div className="text-sm text-n10-text-dim mt-1">Today's Sessions</div>
          </div>
          <div className="bg-n10-mid rounded-xl border border-n10-border p-6 text-center">
            <div className="text-3xl font-bold text-n10-secondary">
              {stats ? formatDuration(stats.avgDuration) : '-'}
            </div>
            <div className="text-sm text-n10-text-dim mt-1">Avg Duration</div>
          </div>
        </div>

        {/* Connect to session */}
        <div className="bg-n10-mid rounded-xl border border-n10-border p-8">
          <h2 className="text-xl font-bold text-n10-text mb-2">Connect to Session</h2>
          <p className="text-n10-text-dim mb-6">
            Enter the session code provided by the client to start remote support.
          </p>
          {error && (
            <div className="bg-n10-danger/10 text-n10-danger px-4 py-3 rounded-xl mb-4 text-sm border border-n10-danger/20">
              {error}
            </div>
          )}
          <CodeEntryForm onSubmit={handleConnect} />
        </div>

        {/* Active sessions list */}
        {sessions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-n10-text mb-3">Active Sessions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <ActiveSessionCard
                  key={session.id}
                  code={session.code}
                  status={session.status}
                  clientIp={session.client_ip || undefined}
                  duration={session.duration_seconds != null ? formatDuration(session.duration_seconds) : undefined}
                  onClick={() => navigate(`/dashboard/session/${session.code}`)}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
