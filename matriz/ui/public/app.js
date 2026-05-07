const app = {
  async dashboard() {
    const r = await fetch('/api/batches');
    const list = await r.json();
    document.getElementById('batches').innerHTML = list.length
      ? list.map((b) => `
        <div class="card">
          <h3>${escapeHtml(b.template)} <small>${escapeHtml(b.batch_id)}</small></h3>
          <div>Iniciado: ${escapeHtml(b.started_at || '?')}</div>
          <div>${b.totals.done}/${b.totals.planned} ok · ${b.totals.failed} falha</div>
          <div class="actions"><a href="/batch/${encodeURIComponent(b.template)}/${encodeURIComponent(b.batch_id)}"><button>Abrir</button></a></div>
        </div>`).join('')
      : '<p>Nenhum lote ainda.</p>';
  },

  async inbox() {
    const r = await fetch('/api/inbox');
    const list = await r.json();
    document.getElementById('inbox').innerHTML = list.length
      ? list.map((t) => `
        <div class="card">
          <h3>${escapeHtml(t.name)}</h3>
          <div><b>Arquivo:</b> ${escapeHtml(t.file)} · <b>Blocos:</b> ${t.blocks} · <b>Formato:</b> ${escapeHtml(t.format || '?')}</div>
          <pre>${escapeHtml(t.raw)}</pre>
          <div class="actions">
            <button onclick="app.approve('${encodeURIComponent(t.file)}')">Aprovar</button>
            <button onclick="app.reject('${encodeURIComponent(t.file)}')">Rejeitar</button>
          </div>
        </div>`).join('')
      : '<p>Inbox vazio.</p>';
  },

  async approve(fileEnc) {
    const file = decodeURIComponent(fileEnc);
    await fetch('/api/inbox/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file }) });
    location.reload();
  },

  async reject(fileEnc) {
    const file = decodeURIComponent(fileEnc);
    const reason = prompt('Motivo (opcional):') || '';
    await fetch('/api/inbox/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file, reason }) });
    location.reload();
  },

  async batch() {
    const m = location.pathname.match(/\/batch\/([^/]+)\/(.+)$/);
    if (!m) return;
    const tmpl = decodeURIComponent(m[1]);
    const bid = decodeURIComponent(m[2]);
    document.getElementById('title').textContent = `Batch ${bid} (${tmpl})`;
    const r = await fetch(`/api/batch/${encodeURIComponent(tmpl)}/${encodeURIComponent(bid)}`);
    const b = await r.json();
    if (b.error) { document.getElementById('batch').innerHTML = '<p>Não encontrado.</p>'; return; }
    const cards = b.videos.map((v) => {
      const status = `status-${v.status}`;
      const videoSrc = v.manifest ? '/' + v.manifest.replace(/manifest\.json$/, 'video.mp4') : null;
      return `<div class="video">
        ${videoSrc ? `<video src="${videoSrc}" controls preload="metadata"></video>` : '<div style="padding:1rem">sem vídeo</div>'}
        <div class="meta">
          <div><b>${escapeHtml(v.slug)}</b> <span class="${status}">${v.status}</span></div>
          ${v.error_message ? `<div style="color:#c88">${escapeHtml(v.error_message)}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    document.getElementById('batch').innerHTML = `<div>${b.totals.done}/${b.totals.planned} ok · ${b.totals.failed} falha</div><div class="grid">${cards}</div>`;
  },
};

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
