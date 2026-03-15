import { useState, useEffect } from 'react';
import Navbar from '../layout/Navbar';
import { useAuth } from '../../context/AuthContext';
import {
  getTechnicians,
  createTechnician,
  updateTechnician,
  deleteTechnician,
  resetTechnicianPassword,
  Technician,
} from '../../api/admin';

export default function TeamPage() {
  const { user } = useAuth();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add form state
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState('technician');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');

  // Reset password state
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');

  const fetchTechnicians = async () => {
    try {
      const data = await getTechnicians();
      setTechnicians(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await createTechnician({ name: addName, email: addEmail, password: addPassword, role: addRole });
      showMsg('success', 'Technician created');
      setShowAdd(false);
      setAddName(''); setAddEmail(''); setAddPassword(''); setAddRole('technician');
      fetchTechnicians();
    } catch (err: any) {
      showMsg('error', err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async (id: string) => {
    try {
      await updateTechnician(id, { name: editName, email: editEmail, role: editRole });
      showMsg('success', 'Technician updated');
      setEditId(null);
      fetchTechnicians();
    } catch (err: any) {
      showMsg('error', err.message);
    }
  };

  const handleToggleActive = async (tech: Technician) => {
    try {
      if (tech.is_active) {
        await deleteTechnician(tech.id);
        showMsg('success', 'Technician deactivated');
      } else {
        await updateTechnician(tech.id, { is_active: true });
        showMsg('success', 'Technician activated');
      }
      fetchTechnicians();
    } catch (err: any) {
      showMsg('error', err.message);
    }
  };

  const handleResetPassword = async (id: string) => {
    if (!resetPw || resetPw.length < 6) {
      showMsg('error', 'Password must be at least 6 characters');
      return;
    }
    try {
      await resetTechnicianPassword(id, resetPw);
      showMsg('success', 'Password reset');
      setResetId(null);
      setResetPw('');
    } catch (err: any) {
      showMsg('error', err.message);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-n10-bg flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-n10-danger text-lg">Admin access required</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-n10-bg flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-n10-text">Team Management</h2>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="btn-gradient text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {showAdd ? 'Cancel' : 'Add Technician'}
          </button>
        </div>

        {message && (
          <div className={`px-4 py-3 rounded-xl mb-4 text-sm border ${
            message.type === 'success'
              ? 'bg-n10-success/10 text-n10-success border-n10-success/20'
              : 'bg-n10-danger/10 text-n10-danger border-n10-danger/20'
          }`}>
            {message.text}
          </div>
        )}

        {showAdd && (
          <form onSubmit={handleAdd} className="bg-n10-mid rounded-xl border border-n10-border p-6 mb-4">
            <h3 className="text-sm font-semibold text-n10-text mb-4">New Technician</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <input
                type="text" value={addName} onChange={(e) => setAddName(e.target.value)}
                placeholder="Full Name" required
                className="px-3 py-2 bg-n10-surface border border-n10-border rounded-lg text-n10-text text-sm placeholder-n10-text-dim/50 outline-none focus:border-n10-primary"
              />
              <input
                type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)}
                placeholder="Email" required
                className="px-3 py-2 bg-n10-surface border border-n10-border rounded-lg text-n10-text text-sm placeholder-n10-text-dim/50 outline-none focus:border-n10-primary"
              />
              <input
                type="password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Password (min 6 chars)" required minLength={6}
                className="px-3 py-2 bg-n10-surface border border-n10-border rounded-lg text-n10-text text-sm placeholder-n10-text-dim/50 outline-none focus:border-n10-primary"
              />
              <select
                value={addRole} onChange={(e) => setAddRole(e.target.value)}
                className="px-3 py-2 bg-n10-surface border border-n10-border rounded-lg text-n10-text text-sm outline-none"
              >
                <option value="technician">Technician</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit" disabled={adding}
              className="btn-gradient text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {adding ? 'Creating...' : 'Create Technician'}
            </button>
          </form>
        )}

        <div className="bg-n10-mid rounded-xl border border-n10-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-n10-border text-n10-text-dim text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-n10-text-dim">Loading...</td></tr>
                ) : technicians.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-n10-text-dim">No technicians</td></tr>
                ) : (
                  technicians.map((tech) => (
                    <tr key={tech.id} className="border-b border-n10-border/50 hover:bg-n10-surface/50">
                      {editId === tech.id ? (
                        <>
                          <td className="px-4 py-2">
                            <input value={editName} onChange={(e) => setEditName(e.target.value)}
                              className="px-2 py-1 bg-n10-surface border border-n10-border rounded text-n10-text text-sm w-full" />
                          </td>
                          <td className="px-4 py-2">
                            <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                              className="px-2 py-1 bg-n10-surface border border-n10-border rounded text-n10-text text-sm w-full" />
                          </td>
                          <td className="px-4 py-2">
                            <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                              className="px-2 py-1 bg-n10-surface border border-n10-border rounded text-n10-text text-sm">
                              <option value="technician">Technician</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium border ${
                              tech.is_active
                                ? 'text-n10-success bg-n10-success/10 border-n10-success/20'
                                : 'text-n10-danger bg-n10-danger/10 border-n10-danger/20'
                            }`}>
                              {tech.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-n10-text-dim">{new Date(tech.created_at + 'Z').toLocaleDateString()}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => handleEdit(tech.id)}
                                className="px-2 py-1 bg-n10-success/20 text-n10-success rounded text-xs font-medium">Save</button>
                              <button onClick={() => setEditId(null)}
                                className="px-2 py-1 bg-n10-surface text-n10-text-dim rounded text-xs font-medium border border-n10-border">Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-n10-text font-medium">{tech.name}</td>
                          <td className="px-4 py-3 text-n10-text-dim">{tech.email}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium border ${
                              tech.role === 'admin'
                                ? 'text-n10-primary bg-n10-primary/10 border-n10-primary/20'
                                : 'text-n10-text-dim bg-n10-surface border-n10-border'
                            }`}>
                              {tech.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium border ${
                              tech.is_active
                                ? 'text-n10-success bg-n10-success/10 border-n10-success/20'
                                : 'text-n10-danger bg-n10-danger/10 border-n10-danger/20'
                            }`}>
                              {tech.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-n10-text-dim">{new Date(tech.created_at + 'Z').toLocaleDateString()}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1 flex-wrap">
                              <button onClick={() => {
                                setEditId(tech.id);
                                setEditName(tech.name);
                                setEditEmail(tech.email);
                                setEditRole(tech.role);
                              }}
                                className="px-2 py-1 bg-n10-surface text-n10-text-dim rounded text-xs font-medium border border-n10-border hover:text-n10-text">
                                Edit
                              </button>
                              {tech.id !== user?.id && (
                                <button onClick={() => handleToggleActive(tech)}
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    tech.is_active
                                      ? 'bg-n10-danger/20 text-n10-danger'
                                      : 'bg-n10-success/20 text-n10-success'
                                  }`}>
                                  {tech.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              )}
                              {resetId === tech.id ? (
                                <div className="flex gap-1 items-center">
                                  <input
                                    type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)}
                                    placeholder="New password"
                                    className="px-2 py-1 bg-n10-surface border border-n10-border rounded text-n10-text text-xs w-28"
                                  />
                                  <button onClick={() => handleResetPassword(tech.id)}
                                    className="px-2 py-1 bg-n10-warning/20 text-n10-warning rounded text-xs font-medium">Set</button>
                                  <button onClick={() => { setResetId(null); setResetPw(''); }}
                                    className="px-2 py-1 bg-n10-surface text-n10-text-dim rounded text-xs border border-n10-border">X</button>
                                </div>
                              ) : (
                                <button onClick={() => setResetId(tech.id)}
                                  className="px-2 py-1 bg-n10-warning/20 text-n10-warning rounded text-xs font-medium">
                                  Reset PW
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
