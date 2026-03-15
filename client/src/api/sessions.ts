import { apiFetch } from './client';

interface CreateSessionResponse {
  id: string;
  code: string;
  expiresAt: string;
}

interface SessionStatus {
  status: string;
  connectedAt: string | null;
  technicianId: string | null;
}

export async function createSession(): Promise<CreateSessionResponse> {
  return apiFetch<CreateSessionResponse>('/sessions/create', {
    method: 'POST',
    skipAuth: true,
  });
}

export async function getSessionStatus(code: string): Promise<SessionStatus> {
  return apiFetch<SessionStatus>(`/sessions/${code}/status`, { skipAuth: true });
}

export async function claimSession(code: string) {
  return apiFetch(`/sessions/${code}/claim`, { method: 'POST' });
}

export async function endSessionApi(code: string, reason = 'manual') {
  return apiFetch(`/sessions/${code}/end`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    skipAuth: true,
  });
}
