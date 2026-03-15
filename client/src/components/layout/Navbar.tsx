import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-n10-mid border-b border-n10-border px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="Numbers10" className="h-8 w-auto" />
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
    </nav>
  );
}
