import { useState, useEffect } from 'react';
import Navbar from '../layout/Navbar';
import { getSessionHistory, Session } from '../../api/admin';

export default function SessionHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getSessionHistory(page, limit, search || undefined, statusFilter);
      setSessions(data.sessions as unknown as Session[]);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchHistory();
  };

  const formatDate = (d: string | null) => {
    if (!d) return '--';
    return new Date(d + 'Z').toLocaleString();
  };

  const formatDuration = (s: number | null) => {
    if (s == null) return '--';
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ended: 'text-n10-text-dim bg-n10-surface border-n10-border',
      view_only: 'text-n10-success bg-n10-success/10 border-n10-success/20',
      control_active: 'text-n10-danger bg-n10-danger/10 border-n10-danger/20',
      connected: 'text-n10-success bg-n10-success/10 border-n10-success/20',
      claimed: 'text-n10-primary bg-n10-primary/10 border-n10-primary/20',
      waiting: 'text-n10-warning bg-n10-warning/10 border-n10-warning/20',
      created: 'text-n10-text-dim bg-n10-surface border-n10-border',
    };
    return colors[status] || colors.created;
  };

  return (
    <div className="min-h-screen bg-n10-bg flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        <h2 className="text-xl font-bold text-n10-text mb-4">Session History</h2>

        <div className="bg-n10-mid rounded-xl border border-n10-border p-4 mb-4 flex flex-wrap gap-3 items-center">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
              placeholder="Search by code..."
              className="flex-1 px-3 py-2 bg-n10-surface border border-n10-border rounded-lg text-n10-text text-sm placeholder-n10-text-dim/50 outline-none focus:border-n10-primary"
            />
            <button type="submit" className="btn-gradient text-white px-4 py-2 rounded-lg text-sm font-medium">
              Search
            </button>
          </form>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-n10-surface border border-n10-border rounded-lg text-n10-text text-sm outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="ended">Ended</option>
            <option value="view_only">View Only</option>
            <option value="control_active">Control Active</option>
            <option value="waiting">Waiting</option>
            <option value="claimed">Claimed</option>
          </select>
          <span className="text-sm text-n10-text-dim">{total} total</span>
        </div>

        <div className="bg-n10-mid rounded-xl border border-n10-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-n10-border text-n10-text-dim text-left">
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Client IP</th>
                  <th className="px-4 py-3 font-medium">Technician</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-n10-text-dim">Loading...</td></tr>
                ) : sessions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-n10-text-dim">No sessions found</td></tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.id} className="border-b border-n10-border/50 hover:bg-n10-surface/50">
                      <td className="px-4 py-3 font-mono font-bold text-n10-text">{s.code}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium border ${statusBadge(s.status)}`}>
                          {s.status.toUpperCase().replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-n10-text-dim">{s.client_ip || '--'}</td>
                      <td className="px-4 py-3 text-n10-text">{s.technician_name || '--'}</td>
                      <td className="px-4 py-3 font-mono text-n10-text-dim">{formatDuration(s.duration_seconds)}</td>
                      <td className="px-4 py-3 text-n10-text-dim">{formatDate(s.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-n10-border flex items-center justify-between">
              <span className="text-sm text-n10-text-dim">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 bg-n10-surface border border-n10-border rounded-lg text-sm text-n10-text disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 bg-n10-surface border border-n10-border rounded-lg text-sm text-n10-text disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
