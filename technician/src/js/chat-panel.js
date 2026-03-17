// In-session chat via DataChannel
const ChatPanel = {
  messages: [],
  unread: 0,
  visible: false,

  toggle() {
    this.visible = !this.visible;
    const panel = document.getElementById('chat-panel');
    if (this.visible) {
      panel.classList.remove('hidden');
      this.unread = 0;
      document.getElementById('chat-badge').classList.add('hidden');
      this.scrollToBottom();
    } else {
      panel.classList.add('hidden');
    }
    // Close other panels
    if (this.visible) {
      SystemInfoPanel.hide();
      NotesPanel.hide();
    }
  },

  hide() {
    this.visible = false;
    const panel = document.getElementById('chat-panel');
    if (panel) panel.classList.add('hidden');
  },

  onReceived(data) {
    this.messages.push(data);
    this.renderMessage(data);
    if (!this.visible) {
      this.unread++;
      const badge = document.getElementById('chat-badge');
      if (badge) {
        badge.textContent = this.unread;
        badge.classList.remove('hidden');
      }
    }
  },

  send() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const msg = {
      type: 'chat',
      sender: 'technician',
      text,
      timestamp: new Date().toISOString(),
    };

    WebRTCManager.sendInput(msg);
    this.messages.push(msg);
    this.renderMessage(msg);
    input.value = '';
  },

  renderMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `chat-msg ${msg.sender === 'technician' ? 'chat-msg-out' : 'chat-msg-in'}`;

    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<div class="chat-bubble">${this.escapeHtml(msg.text)}</div><span class="chat-time">${time}</span>`;

    container.appendChild(div);
    this.scrollToBottom();
  },

  scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  reset() {
    this.messages = [];
    this.unread = 0;
    this.visible = false;
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = '';
    const badge = document.getElementById('chat-badge');
    if (badge) badge.classList.add('hidden');
  },
};
