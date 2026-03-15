import { apiFetch } from './client';

interface LoginResponse {
  token: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: string };
}

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
}
