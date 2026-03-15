// Authentication module
const Auth = {
  user: null,

  init() {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { this.user = JSON.parse(stored); } catch {}
    }
    return !!localStorage.getItem('token') && this.user;
  },

  async login(email, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });

    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    this.user = data.user;
    return data.user;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    this.user = null;
  },

  getUser() {
    return this.user;
  },
};
