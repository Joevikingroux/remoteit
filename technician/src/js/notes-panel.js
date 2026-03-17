// Session notes & tagging panel
const NotesPanel = {
  notes: '',
  tags: [],
  visible: false,
  saving: false,

  AVAILABLE_TAGS: ['#hardware', '#software', '#network', '#printer', '#email', '#security', '#account', '#other'],

  toggle() {
    this.visible = !this.visible;
    const panel = document.getElementById('notes-panel');
    if (this.visible) {
      panel.classList.remove('hidden');
      this.render();
    } else {
      panel.classList.add('hidden');
    }
    // Close other panels
    if (this.visible) {
      ChatPanel.hide();
      SystemInfoPanel.hide();
    }
  },

  hide() {
    this.visible = false;
    const panel = document.getElementById('notes-panel');
    if (panel) panel.classList.add('hidden');
  },

  toggleTag(tag) {
    const idx = this.tags.indexOf(tag);
    if (idx >= 0) {
      this.tags.splice(idx, 1);
    } else {
      this.tags.push(tag);
    }
    this.render();
  },

  async save() {
    if (this.saving || !Session.sessionCode) return;
    this.saving = true;
    const btn = document.getElementById('notes-save-btn');
    if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

    const textarea = document.getElementById('notes-textarea');
    if (textarea) this.notes = textarea.value;

    try {
      await apiFetch(`/sessions/${Session.sessionCode}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: this.notes, tags: this.tags }),
      });
    } catch (e) {
      console.error('Failed to save notes:', e);
    }

    this.saving = false;
    if (btn) { btn.textContent = 'Save Notes'; btn.disabled = false; }
  },

  render() {
    const container = document.getElementById('notes-content');
    if (!container) return;

    let tagsHtml = this.AVAILABLE_TAGS.map(tag => {
      const active = this.tags.includes(tag);
      return `<button class="tag-btn ${active ? 'active' : ''}" onclick="NotesPanel.toggleTag('${tag}')">${tag}</button>`;
    }).join('');

    container.innerHTML = `
      <div class="notes-section">
        <label class="panel-label">Tags</label>
        <div class="tags-row">${tagsHtml}</div>
      </div>
      <div class="notes-section notes-grow">
        <label class="panel-label">Notes</label>
        <textarea id="notes-textarea" class="notes-textarea" placeholder="Session notes...">${this.escapeHtml(this.notes)}</textarea>
      </div>
      <button id="notes-save-btn" class="btn-primary notes-save-btn" onclick="NotesPanel.save()">Save Notes</button>
    `;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  reset() {
    this.notes = '';
    this.tags = [];
    this.visible = false;
  },
};
