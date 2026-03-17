// System info panel — displays client machine info received via DataChannel
const SystemInfoPanel = {
  info: null,
  visible: false,

  LABELS: {
    os: 'OS',
    hostname: 'Hostname',
    username: 'User',
    cpu: 'CPU',
    cores: 'Cores',
    ram_total: 'RAM Total',
    ram_used: 'RAM Used',
    ram_percent: 'RAM Usage',
    resolution: 'Resolution',
    uptime: 'Uptime',
    disk_total: 'Disk (C:)',
    disk_free: 'Disk Free',
  },

  toggle() {
    this.visible = !this.visible;
    const panel = document.getElementById('sysinfo-panel');
    if (this.visible) {
      panel.classList.remove('hidden');
      this.render();
    } else {
      panel.classList.add('hidden');
    }
    // Close other panels
    if (this.visible) {
      ChatPanel.hide();
      NotesPanel.hide();
    }
  },

  hide() {
    this.visible = false;
    const panel = document.getElementById('sysinfo-panel');
    if (panel) panel.classList.add('hidden');
  },

  onReceived(info) {
    this.info = info;
    if (this.visible) this.render();
  },

  refresh() {
    WebRTCManager.sendInput({ type: 'system-info-request' });
  },

  render() {
    const container = document.getElementById('sysinfo-content');
    if (!container) return;

    if (!this.info) {
      container.innerHTML = '<p class="empty-text">Waiting for client system info...</p>';
      return;
    }

    let html = '';
    for (const [key, label] of Object.entries(this.LABELS)) {
      const val = this.info[key];
      if (!val) continue;
      html += `<div class="sysinfo-row">
        <span class="sysinfo-label">${label}</span>
        <span class="sysinfo-value" title="${this.escapeHtml(val)}">${this.escapeHtml(val)}</span>
      </div>`;
    }
    container.innerHTML = html || '<p class="empty-text">No system info available</p>';
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  reset() {
    this.info = null;
    this.visible = false;
  },
};
