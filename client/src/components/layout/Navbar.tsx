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
    <nav className="bg-blue-600 text-white px-6 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
          <span className="text-blue-600 font-bold text-sm">IT</span>
        </div>
        <span className="font-semibold text-lg">RemoteIT Dashboard</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm opacity-90">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded text-sm transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
