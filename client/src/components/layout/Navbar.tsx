import { useAuth } from '../../context/AuthContext';
import { useNavigate, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getActiveSessions } from '../../api/admin';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const sessions = await getActiveSessions();
        if (!cancelled) setActiveCount(sessions.length);
      } catch {
        // ignore
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-n10-primary/15 text-n10-primary'
        : 'text-n10-text-dim hover:text-n10-text hover:bg-n10-surface'
    }`;

  return (
    <nav className="bg-n10-mid border-b border-n10-border shrink-0">
      {/* Top bar */}
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Numbers10" className="h-8 w-auto" />
          <span className="font-semibold text-lg text-n10-text">Numbers10 Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-n10-text-dim">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="bg-n10-surface hover:bg-n10-border text-n10-text px-3 py-1.5 rounded-lg text-sm transition-colors border border-n10-border"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="px-6 pb-2 flex items-center gap-1 overflow-x-auto">
        <NavLink to="/dashboard" end className={linkClass}>
          Home
        </NavLink>

        <NavLink to="/dashboard/sessions" className={({ isActive }) =>
          `px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
            isActive
              ? 'bg-n10-primary/15 text-n10-primary'
              : 'text-n10-text-dim hover:text-n10-text hover:bg-n10-surface'
          }`
        }>
          Active Sessions
          {activeCount > 0 && (
            <span className="bg-n10-primary text-n10-bg text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {activeCount}
            </span>
          )}
        </NavLink>

        <NavLink to="/dashboard/history" className={linkClass}>
          Session History
        </NavLink>

        {user?.role === 'admin' && (
          <NavLink to="/dashboard/team" className={linkClass}>
            Team
          </NavLink>
        )}

        <NavLink to="/dashboard/settings" className={linkClass}>
          Settings
        </NavLink>
      </div>
    </nav>
  );
}
