// API client with JWT auth and auto-refresh
const API_BASE = 'https://remoteit.numbers10.co.za/api';

async function apiFetch(path, options = {}) {
  const { skipAuth, ...fetchOpts } = options;

  const headers = {
    'Content-Type': 'application/json',
    ...(fetchOpts.headers || {}),
  };

  if (!skipAuth) {
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;
  console.log('[API]', fetchOpts.method || 'GET', url, fetchOpts.body);

  const res = await fetch(url, {
    method: fetchOpts.method || 'GET',
    headers,
    body: fetchOpts.body || undefined,
  });

  console.log('[API] Response:', res.status, res.statusText);

  // Auto-refresh on 401
  if (res.status === 401 && !skipAuth) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem('token', data.token);
          headers['Authorization'] = `Bearer ${data.token}`;
          const retryRes = await fetch(url, {
            method: fetchOpts.method || 'GET',
            headers,
            body: fetchOpts.body || undefined,
          });
          if (!retryRes.ok) throw new Error('Request failed after refresh');
          return retryRes.json();
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        App.showView('login');
      }
    }
  }

  if (!res.ok) {
    const text = await res.text();
    console.log('[API] Error body:', text);
    let errMsg = 'Request failed';
    try {
      const err = JSON.parse(text);
      errMsg = err.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  return res.json();
}
