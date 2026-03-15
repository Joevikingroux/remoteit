// Dashboard: stats + active sessions
const Dashboard = {
  interval: null,

  async load() {
    document.getElementById('user-name').textContent = Auth.getUser()?.name || '';
    this.fetchData();
    this.interval = setInterval(() => this.fetchData(), 10000);
  },

  unload() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },

  async fetchData() {
    try {
      const [stats, sessionsData] = await Promise.all([
        apiFetch('/stats/dashboard'),
        apiFetch('/sessions'),
      ]);

      document.getElementById('stat-active').textContent = stats.activeSessions || 0;
      document.getElementById('stat-today').textContent = stats.todayTotal || 0;
      document.getElementById('stat-avg').textContent = (stats.avgDuration || 0) + 'm';

      this.renderSessions(sessionsData.sessions || sessionsData || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  },

  renderSessions(sessions) {
    const grid = document.getElementById('sessions-grid');
    const active = sessions.filter(s => !['ended', 'created'].includes(s.status));

    if (active.length === 0) {
      grid.innerHTML = '<p class="empty-text">No active sessions</p>';
      return;
    }

    grid.innerHTML = active.map(s => {
      const code = s.code.match(/.{1,2}/g)?.join(' ') || s.code;
      return `
        <div class="session-card" data-code="${s.code}">
          <div class="code">${code}</div>
          <div class="meta">${s.client_os || 'Unknown OS'} • ${s.client_ip || ''}</div>
          <span class="status-tag ${s.status}">${s.status.replace('_', ' ')}</span>
        </div>
      `;
    }).join('');

    // Click to connect
    grid.querySelectorAll('.session-card').forEach(card => {
      card.addEventListener('click', () => {
        const code = card.dataset.code;
        Session.connect(code);
      });
    });
  },
};
