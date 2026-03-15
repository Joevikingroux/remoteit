import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../layout/Navbar';
import CodeEntryForm from './CodeEntryForm';
import { claimSession } from '../../api/sessions';

export default function DashboardPage() {
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleConnect = async (code: string) => {
    setError('');
    try {
      await claimSession(code);
      navigate(`/dashboard/session/${code.toUpperCase()}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-n10-bg flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col gap-6">
        <div className="bg-n10-mid rounded-xl border border-n10-border p-8">
          <h2 className="text-xl font-bold text-n10-text mb-2">Connect to Session</h2>
          <p className="text-n10-text-dim mb-6">Enter the session code provided by the client to start remote support.</p>
          {error && (
            <div className="bg-n10-danger/10 text-n10-danger px-4 py-3 rounded-xl mb-4 text-sm border border-n10-danger/20">{error}</div>
          )}
          <CodeEntryForm onSubmit={handleConnect} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-n10-mid rounded-xl border border-n10-border p-6 text-center">
            <div className="text-3xl font-bold text-n10-primary">-</div>
            <div className="text-sm text-n10-text-dim mt-1">Active Sessions</div>
          </div>
          <div className="bg-n10-mid rounded-xl border border-n10-border p-6 text-center">
            <div className="text-3xl font-bold text-n10-success">-</div>
            <div className="text-sm text-n10-text-dim mt-1">Today's Sessions</div>
          </div>
          <div className="bg-n10-mid rounded-xl border border-n10-border p-6 text-center">
            <div className="text-3xl font-bold text-n10-secondary">-</div>
            <div className="text-sm text-n10-text-dim mt-1">Avg Duration</div>
          </div>
        </div>
      </main>
    </div>
  );
}
