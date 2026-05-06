/**
 * Cliente HTTP do inemavox (192.168.2.99:3010 / FastAPI :8010).
 *
 * Endpoints:
 *   POST /api/audio/search   { query, kind, per_page, min_duration, max_duration }
 *   POST /api/audio/download { source, external_id, preview_url, name, kind, license, author }
 *   GET  /api/audio/library
 *   GET  /api/audio/file
 *
 * Pra darkstory: busca uma vez, baixa pra cache local em media/{musicas,sfx}/dark/,
 * depois reusa. Search Freesound pode demorar 15-40s — timeout amplo.
 */

const fs = require('fs');
const path = require('path');

const HOST = process.env.INEMAVOX_URL || 'http://192.168.2.99:3010';
const ROOT = path.resolve(__dirname, '..');
const MUSIC_DIR = path.join(ROOT, 'media', 'musicas', 'dark');
const SFX_DIR = path.join(ROOT, 'media', 'sfx', 'dark');
fs.mkdirSync(MUSIC_DIR, { recursive: true });
fs.mkdirSync(SFX_DIR, { recursive: true });

async function search({ query, kind, perPage = 5, minDuration, maxDuration, sort = 'rating', translate = true }) {
  const body = { query, kind, per_page: perPage, sort, translate };
  if (minDuration) body.min_duration = minDuration;
  if (maxDuration) body.max_duration = maxDuration;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${HOST}/api/audio/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`search HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

async function downloadHit(hit, kind) {
  const body = {
    source: hit.source || 'freesound',
    external_id: String(hit.external_id || hit.id || ''),
    preview_url: hit.preview_url || hit.preview_hq_mp3 || hit.preview_lq_mp3,
    name: hit.name || hit.title || 'audio',
    kind,
    license: hit.license || '',
    author: hit.author || hit.username || '',
  };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${HOST}/api/audio/download`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`download HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

async function fetchFile(remotePath) {
  const url = `${HOST}/api/audio/file?path=${encodeURIComponent(remotePath)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`file HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally { clearTimeout(t); }
}

/**
 * Busca, baixa e salva localmente num path determinístico.
 * Reusa cache se já baixou. Retorna o path local do mp3.
 */
async function getOrFetch(query, kind, opts = {}) {
  const dir = kind === 'music' ? MUSIC_DIR : SFX_DIR;
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const localPath = path.join(dir, `${slug}.mp3`);
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 1000) {
    return { path: localPath, cached: true };
  }

  console.log(`  [inemavox] busca ${kind}: "${query}" ...`);
  const r = await search({ query, kind, perPage: 5, ...opts });
  if (!r.hits || r.hits.length === 0) throw new Error(`sem resultado para "${query}"`);
  // Top hit
  const hit = r.hits[0];
  console.log(`  [inemavox] baixa: ${hit.name || hit.title} (${hit.duration?.toFixed?.(1) || '?'}s)`);
  const dl = await downloadHit(hit, kind);

  // Tenta puxar o mp3 do path retornado, ou do preview_url direto
  if (dl.local_path || dl.path) {
    const remote = dl.local_path || dl.path;
    try {
      const buf = await fetchFile(remote);
      fs.writeFileSync(localPath, buf);
      return { path: localPath, cached: false, hit };
    } catch (e) {
      console.warn(`  [inemavox] /file falhou (${e.message}), tentando preview direto...`);
    }
  }
  // Fallback: baixa do preview_url do hit
  if (hit.preview_url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000);
    try {
      const res = await fetch(hit.preview_url, { signal: ctrl.signal });
      if (res.ok) {
        fs.writeFileSync(localPath, Buffer.from(await res.arrayBuffer()));
        return { path: localPath, cached: false, hit };
      }
    } finally { clearTimeout(t); }
  }
  throw new Error('não consegui obter o mp3');
}

module.exports = { search, downloadHit, fetchFile, getOrFetch, MUSIC_DIR, SFX_DIR, HOST };
