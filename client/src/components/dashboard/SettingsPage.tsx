import { useState } from 'react';
import Navbar from '../layout/Navbar';
import { useAuth } from '../../context/AuthContext';
import { changeMyPassword } from '../../api/admin';

export default function SettingsPage() {
  const { user } = useAuth();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (newPw.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await changeMyPassword(currentPw, newPw);
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-n10-bg flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl w-full mx-auto p-6 flex flex-col gap-6">
        <h2 className="text-xl font-bold text-n10-text">Settings</h2>

        {/* Profile Info */}
        <div className="bg-n10-mid rounded-xl border border-n10-border p-6">
          <h3 className="text-sm font-semibold text-n10-text-dim mb-4 uppercase tracking-wider">Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-n10-text-dim mb-1">Name</label>
              <div className="px-3 py-2 bg-n10-surface border border-n10-border rounded-lg text-n10-text text-sm">{user?.name}</div>
            </div>
            <div>
              <label className="block text-xs text-n10-text-dim mb-1">Email</label>
              <div className="px-3 py-2 bg-n10-surface border border-n10-border rounded-lg text-n10-text text-sm">{user?.email}</div>
            </div>
            <div>
              <label className="block text-xs text-n10-text-dim mb-1">Role</label>
              <div className="px-3 py-2 bg-n10-surface border border-n10-border rounded-lg text-sm">
                <span className={`text-xs px-2 py-1 rounded-full font-medium border ${
                  user?.role === 'admin'
                    ? 'text-n10-primary bg-n10-primary/10 border-n10-primary/20'
                    : 'text-n10-text-dim bg-n10-surface border-n10-border'
                }`}>
                  {user?.role?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-n10-mid rounded-xl border border-n10-border p-6">
          <h3 className="text-sm font-semibold text-n10-text-dim mb-4 uppercase tracking-wider">Change Password</h3>

          {message && (
            <div className={`px-4 py-3 rounded-xl mb-4 text-sm border ${
              message.type === 'success'
                ? 'bg-n10-success/10 text-n10-success border-n10-success/20'
                : 'bg-n10-danger/10 text-n10-danger border-n10-danger/20'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs text-n10-text-dim mb-1">Current Password</label>
              <input
                type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                required
                className="w-full px-3 py-2 bg-n10-surface border border-n10-border rounded-lg text-n10-text text-sm placeholder-n10-text-dim/50 outline-none focus:border-n10-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-n10-text-dim mb-1">New Password</label>
              <input
                type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                required minLength={6}
                className="w-full px-3 py-2 bg-n10-surface border border-n10-border rounded-lg text-n10-text text-sm placeholder-n10-text-dim/50 outline-none focus:border-n10-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-n10-text-dim mb-1">Confirm New Password</label>
              <input
                type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                required minLength={6}
                className="w-full px-3 py-2 bg-n10-surface border border-n10-border rounded-lg text-n10-text text-sm placeholder-n10-text-dim/50 outline-none focus:border-n10-primary"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="btn-gradient text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
