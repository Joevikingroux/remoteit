// File transfer via copy-paste / drag-and-drop — no buttons needed
// Copy a file on technician's PC, paste it on the remote session = transfer
const CHUNK_SIZE = 16384; // 16KB chunks

const FileTransfer = {
  sending: false,

  // Send a file by path (used when pasting files from clipboard via Tauri)
  async sendFilePath(filePath) {
    if (this.sending) return;

    try {
      const fileData = await window.__TAURI__.core.invoke('read_file_base64', { path: filePath });

      this.sending = true;
      const fileId = Math.random().toString(36).substring(2, 10);
      const totalSize = fileData.size;

      WebRTCManager.sendInput({
        type: 'file-start',
        fileId,
        filename: fileData.name,
        size: totalSize,
      });

      this.showProgress(fileData.name, 0);

      const raw = fileData.data;
      let offset = 0;
      const chunkB64Size = Math.ceil(CHUNK_SIZE * 4 / 3);

      while (offset < raw.length) {
        const chunk = raw.slice(offset, offset + chunkB64Size);
        WebRTCManager.sendInput({ type: 'file-chunk', fileId, chunk });
        offset += chunkB64Size;
        const progress = Math.min(100, Math.round((offset / raw.length) * 100));
        this.showProgress(fileData.name, progress);
        await new Promise(r => setTimeout(r, 5));
      }

      WebRTCManager.sendInput({ type: 'file-end', fileId });
      this.sending = false;
      this.hideProgress();
    } catch (err) {
      console.error('File transfer error:', err);
      this.sending = false;
      this.hideProgress();
    }
  },

  // Send files from drag-and-drop (browser File objects)
  async sendDroppedFiles(files) {
    for (const file of files) {
      if (this.sending) return;
      this.sending = true;

      const fileId = Math.random().toString(36).substring(2, 10);
      const totalSize = file.size;

      WebRTCManager.sendInput({
        type: 'file-start',
        fileId,
        filename: file.name,
        size: totalSize,
      });

      this.showProgress(file.name, 0);

      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let sent = 0;

        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
          const chunk = bytes.slice(i, i + CHUNK_SIZE);
          const base64 = btoa(String.fromCharCode(...chunk));
          WebRTCManager.sendInput({ type: 'file-chunk', fileId, chunk: base64 });
          sent += chunk.length;
          this.showProgress(file.name, Math.round((sent / totalSize) * 100));
          await new Promise(r => setTimeout(r, 5));
        }

        WebRTCManager.sendInput({ type: 'file-end', fileId });
      } catch (err) {
        console.error('File transfer error:', err);
      }

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
  },

  hideProgress() {
    document.getElementById('file-status').classList.add('hidden');
  },
};
