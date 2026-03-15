import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-n10-bg flex items-center justify-center p-6">
      <div className="bg-n10-mid rounded-2xl border border-n10-border max-w-md w-full p-8">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Numbers10" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-n10-text">Numbers10</h1>
          <p className="text-n10-text-dim mt-1">Technician Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-n10-danger/10 text-n10-danger px-4 py-3 rounded-xl text-sm border border-n10-danger/20">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-n10-text-dim mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-n10-surface border border-n10-border rounded-xl text-n10-text placeholder-n10-text-dim/50 focus:ring-2 focus:ring-n10-primary focus:border-n10-primary outline-none transition-colors"
              placeholder="admin@numbers10.co.za"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-n10-text-dim mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-n10-surface border border-n10-border rounded-xl text-n10-text placeholder-n10-text-dim/50 focus:ring-2 focus:ring-n10-primary focus:border-n10-primary outline-none transition-colors"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-gradient text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
