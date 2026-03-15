import { apiFetch } from './client';

// Types
export interface DashboardStats {
  activeSessions: number;
  todayTotal: number;
  avgDuration: number;
}

export interface Session {
  id: string;
  code: string;
  status: string;
  client_ip: string | null;
  client_os: string | null;
  client_hostname: string | null;
  technician_id: string | null;
  technician_name?: string;
  created_at: string;
  claimed_at: string | null;
  connected_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  tags: string[];
}

export interface Technician {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface PaginatedSessions {
  sessions: Session[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PaginatedAudit {
  entries: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AuditEntry {
  id: number;
  session_id: string | null;
  timestamp: string;
  actor: string;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown>;
  ip: string | null;
}

// Stats
export async function getStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/stats/dashboard');
}

// Sessions
export async function getActiveSessions(): Promise<Session[]> {
  return apiFetch<Session[]>('/sessions');
}

export async function getSessionHistory(
  page: number,
  limit: number,
  search?: string,
  status?: string
): Promise<PaginatedSessions> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  if (status && status !== 'all') params.set('status', status);
  return apiFetch<PaginatedSessions>(`/sessions/history?${params.toString()}`);
}

// Technicians (admin)
export async function getTechnicians(): Promise<Technician[]> {
  return apiFetch<Technician[]>('/admin/technicians');
}

export async function createTechnician(data: {
  name: string;
  email: string;
  password: string;
  role: string;
}): Promise<Technician> {
  return apiFetch<Technician>('/admin/technicians', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTechnician(
  id: string,
  data: { name?: string; email?: string; role?: string; is_active?: boolean }
): Promise<Technician> {
  return apiFetch<Technician>(`/admin/technicians/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTechnician(id: string): Promise<void> {
  return apiFetch<void>(`/admin/technicians/${id}`, { method: 'DELETE' });
}

export async function resetTechnicianPassword(id: string, password: string): Promise<void> {
  return apiFetch<void>(`/admin/technicians/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

// Auth
export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiFetch<void>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// Audit log
export async function getAuditLog(
  page: number,
  limit: number
): Promise<PaginatedAudit> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch<PaginatedAudit>(`/stats/audit-log?${params.toString()}`);
}
