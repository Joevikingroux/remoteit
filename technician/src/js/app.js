// App shell: routing, event binding, initialization
const App = {
  showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`${name}-view`);
    if (view) view.classList.add('active');
  },

  init() {
    // Check existing auth
    if (Auth.init()) {
      this.showView('dashboard');
      Dashboard.load();
    } else {
      this.showView('login');
    }

    // ── Login form ──
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const btn = document.getElementById('login-btn');
      const errEl = document.getElementById('login-error');

      btn.disabled = true;
      btn.textContent = 'Signing in...';
      errEl.classList.add('hidden');

      try {
        await Auth.login(email, password);
        App.showView('dashboard');
        Dashboard.load();
      } catch (err) {
        errEl.textContent = err.message || 'Login failed';
        errEl.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });

    // ── Logout ──
    document.getElementById('logout-btn').addEventListener('click', () => {
      Dashboard.unload();
      Auth.logout();
      App.showView('login');
    });

    // ── Session code entry ──
    const codeInput = document.getElementById('session-code');
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
    });

    document.getElementById('connect-btn').addEventListener('click', () => {
      const code = codeInput.value;
      const errEl = document.getElementById('connect-error');
      if (code.length !== 6) {
        errEl.textContent = 'Please enter a valid 6-character code';
        errEl.classList.remove('hidden');
        return;
      }
      errEl.classList.add('hidden');
      Session.connect(code);
    });

    // ── Session toolbar buttons ──
    document.getElementById('back-btn').addEventListener('click', () => {
      Session.endSession();
    });

    document.getElementById('end-session-btn').addEventListener('click', () => {
      Session.endSession();
    });

    document.getElementById('control-btn').addEventListener('click', () => {
      Session.handleRequestControl();
    });

    document.getElementById('release-btn').addEventListener('click', () => {
      Session.handleReleaseControl();
    });

    document.getElementById('sas-btn').addEventListener('click', () => {
      WebRTCManager.sendInput({ type: 'send-sas' });
    });

    // ── Phase 3 toolbar buttons ──
    document.getElementById('screenshot-btn').addEventListener('click', () => {
      Session.takeScreenshot();
    });

    document.getElementById('sysinfo-btn').addEventListener('click', () => {
      SystemInfoPanel.toggle();
    });

    document.getElementById('chat-btn').addEventListener('click', () => {
      ChatPanel.toggle();
    });

    document.getElementById('notes-btn').addEventListener('click', () => {
      NotesPanel.toggle();
    });

    // Panel close/action buttons
    document.getElementById('chat-close-btn').addEventListener('click', () => {
      ChatPanel.hide();
    });

    document.getElementById('chat-send-btn').addEventListener('click', () => {
      ChatPanel.send();
    });

    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        ChatPanel.send();
      }
    });

    document.getElementById('sysinfo-close-btn').addEventListener('click', () => {
      SystemInfoPanel.hide();
    });

    document.getElementById('sysinfo-refresh-btn').addEventListener('click', () => {
      SystemInfoPanel.refresh();
    });

    document.getElementById('notes-close-btn').addEventListener('click', () => {
      NotesPanel.hide();
    });

    // ── Listen for toolbar release control event ──
    if (window.__TAURI__?.event) {
      window.__TAURI__.event.listen('toolbar-release-control', () => {
        Session.handleReleaseControl();
      });
    }
  },
};

// Start the app
document.addEventListener('DOMContentLoaded', () => App.init());
