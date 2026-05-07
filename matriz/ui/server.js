const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.MATRIZ_UI_PORT || 5278;

function safeJoin(base, file) {
  const resolved = path.join(base, file);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('invalid file path');
  }
  return resolved;
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function sendJSON(res, obj) { send(res, 200, 'application/json', JSON.stringify(obj)); }
function sendFile(res, file, type) { send(res, 200, type, fs.readFileSync(file)); }

function listInbox() {
  const dir = path.join(ROOT, 'templates/inbox');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.yml')).map((f) => {
    const full = path.join(dir, f);
    const content = fs.readFileSync(full, 'utf8');
    let parsed = null;
    try { parsed = yaml.load(content); } catch (e) { /* ignora */ }
    return {
      file: f,
      name: parsed?.meta?.name || f,
      blocks: parsed?.script?.length || 0,
      format: parsed?.format?.key,
      raw: content,
    };
  });
}

function listBatches() {
  const out = path.join(ROOT, 'output');
  if (!fs.existsSync(out)) return [];
  const all = [];
  for (const tmpl of fs.readdirSync(out)) {
    const batches = path.join(out, tmpl, '_batches');
    if (!fs.existsSync(batches)) continue;
    for (const f of fs.readdirSync(batches)) {
      if (!f.endsWith('.json') || f.includes('_stdout') || f.includes('_errors') || f.includes('_llm-usage')) continue;
      try {
        const s = JSON.parse(fs.readFileSync(path.join(batches, f), 'utf8'));
        all.push({ template: tmpl, batch_id: s.batch_id, started_at: s.started_at, totals: s.totals });
      } catch (e) { /* ignora */ }
    }
  }
  return all.sort((a, b) => (b.started_at || '').localeCompare(a.started_at || '')).slice(0, 50);
}

function getBatch(templateId, batchId) {
  const f = path.join(ROOT, 'output', templateId, '_batches', `${batchId}.json`);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (req.method === 'GET' && p === '/') return sendFile(res, path.join(PUBLIC, 'index.html'), 'text/html');
  if (req.method === 'GET' && p === '/inbox') return sendFile(res, path.join(PUBLIC, 'inbox.html'), 'text/html');
  if (req.method === 'GET' && p.startsWith('/batch/')) return sendFile(res, path.join(PUBLIC, 'batch.html'), 'text/html');

  if (req.method === 'GET' && p === '/api/inbox') return sendJSON(res, listInbox());
  if (req.method === 'GET' && p === '/api/batches') return sendJSON(res, listBatches());
  if (req.method === 'GET' && p.startsWith('/api/batch/')) {
    const parts = p.split('/').filter(Boolean);
    // parts: ['api', 'batch', tmpl, bid]
    if (parts.length === 4) return sendJSON(res, getBatch(parts[2], parts[3]) || { error: 'not found' });
    return sendJSON(res, { error: 'bad path' });
  }

  if (req.method === 'POST' && p === '/api/inbox/approve') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const { file } = JSON.parse(body);
        const src = safeJoin(path.join(ROOT, 'templates/inbox'), file);
        const dst = safeJoin(path.join(ROOT, 'templates/approved'), file);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.renameSync(src, dst);
        sendJSON(res, { ok: true });
      } catch (e) { send(res, 400, 'application/json', JSON.stringify({ error: e.message })); }
    });
    return;
  }
  if (req.method === 'POST' && p === '/api/inbox/reject') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const { file, reason } = JSON.parse(body);
        const src = safeJoin(path.join(ROOT, 'templates/inbox'), file);
        const dst = safeJoin(path.join(ROOT, 'templates/archive'), file);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.renameSync(src, dst);
        if (reason) {
          const rejectFile = safeJoin(path.join(ROOT, 'templates/archive'), file.replace('.yml', '.reject.txt'));
          fs.writeFileSync(rejectFile, reason);
        }
        sendJSON(res, { ok: true });
      } catch (e) { send(res, 400, 'application/json', JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // estáticos /public/*
  if (req.method === 'GET' && p.startsWith('/public/')) {
    const f = path.join(PUBLIC, p.slice(8));
    if (fs.existsSync(f) && f.startsWith(PUBLIC)) {
      const ext = path.extname(f);
      const type = { '.css': 'text/css', '.js': 'application/javascript', '.html': 'text/html' }[ext] || 'application/octet-stream';
      return sendFile(res, f, type);
    }
  }

  // arquivos de output
  if (req.method === 'GET' && p.startsWith('/output/')) {
    const f = path.join(ROOT, p);
    if (fs.existsSync(f) && f.startsWith(path.join(ROOT, 'output')) && fs.statSync(f).isFile()) {
      const ext = path.extname(f);
      const type = {
        '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.json': 'application/json', '.txt': 'text/plain'
      }[ext] || 'application/octet-stream';
      return sendFile(res, f, type);
    }
  }

  send(res, 404, 'text/plain', 'not found');
});

server.listen(PORT, () => console.log(`matriz UI — http://localhost:${PORT}`));
