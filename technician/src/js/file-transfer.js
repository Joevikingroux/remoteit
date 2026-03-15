// File transfer via Tauri dialog + DataChannel
const CHUNK_SIZE = 16384; // 16KB chunks

const FileTransfer = {
  sending: false,

  async sendFile() {
    if (this.sending) return;

    try {
      // Use Tauri dialog to pick a file
      const result = await window.__TAURI__.dialog.open({
        multiple: false,
        title: 'Select file to send',
      });

      if (!result) return; // cancelled
      const filePath = typeof result === 'string' ? result : result.path;

      // Read file via Tauri command
      const fileData = await window.__TAURI__.core.invoke('read_file_base64', { path: filePath });

      this.sending = true;
      const fileId = Math.random().toString(36).substring(2, 10);
      const totalSize = fileData.size;

      // Send metadata
      WebRTCManager.sendInput({
        type: 'file-start',
        fileId,
        filename: fileData.name,
        size: totalSize,
      });

      this.showProgress(fileData.name, 0);

      // Send chunks
      const raw = fileData.data; // base64 string
      let offset = 0;
      const chunkB64Size = Math.ceil(CHUNK_SIZE * 4 / 3); // base64 chunk size

      const sendNext = async () => {
        while (offset < raw.length) {
          const chunk = raw.slice(offset, offset + chunkB64Size);
          WebRTCManager.sendInput({ type: 'file-chunk', fileId, chunk });
          offset += chunkB64Size;
          const progress = Math.min(100, Math.round((offset / raw.length) * 100));
          this.showProgress(fileData.name, progress);
          // Small delay to avoid overwhelming DataChannel
          await new Promise(r => setTimeout(r, 5));
        }

        WebRTCManager.sendInput({ type: 'file-end', fileId });
        this.sending = false;
        this.hideProgress();
      };

      sendNext().catch(() => {
        this.sending = false;
        this.hideProgress();
      });
    } catch (err) {
      console.error('File transfer error:', err);
      this.sending = false;
      this.hideProgress();
    }
  },

  showProgress(name, percent) {
    const el = document.getElementById('file-status');
    el.innerHTML = `
      <span class="file-progress">
        Sending ${name}...
        <span class="progress-track"><span class="progress-fill" style="width:${percent}%"></span></span>
        ${percent}%
      </span>
    `;
    el.classList.remove('hidden');
    document.getElementById('send-file-btn').disabled = true;
  },

  hideProgress() {
    document.getElementById('file-status').classList.add('hidden');
    document.getElementById('send-file-btn').disabled = false;
  },
};
