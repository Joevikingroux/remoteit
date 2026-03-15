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
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto p-6">
        {/* Session Code Entry */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Connect to Session</h2>
          <p className="text-gray-500 mb-6">Enter the session code provided by the client to start remote support.</p>
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
          )}
          <CodeEntryForm onSubmit={handleConnect} />
        </div>

        {/* Quick stats placeholder */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">-</div>
            <div className="text-sm text-gray-500 mt-1">Active Sessions</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <div className="text-3xl font-bold text-green-600">-</div>
            <div className="text-sm text-gray-500 mt-1">Today's Sessions</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <div className="text-3xl font-bold text-purple-600">-</div>
            <div className="text-sm text-gray-500 mt-1">Avg Duration</div>
          </div>
        </div>
      </main>
    </div>
  );
}
