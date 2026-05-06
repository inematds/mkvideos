#!/usr/bin/env node
/**
 * mkvideos — UI mínima read-only.
 *
 * Servidor http vanilla, sem dependências, sem escrita.
 * Mostra:
 *   - lista de campanhas (prj/<proj>/outputs/<task>) com payload + contagens + previews
 *   - config do projeto (versão, CLAUDE.md head, skills, knowledge files)
 *
 * Não chama spawn, não escreve arquivos, não toca em fila.
 * Mata-se com ctrl-c. Roda em http://localhost:5178 (MKVIDEOS_UI_PORT).
 *
 * Uso: node ui/server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const OUTPUT_VIDEOS_DIR = path.join(ROOT, 'output', 'videos');
const PRJ_DIR = path.join(ROOT, 'prj');
const HOST = process.env.MKVIDEOS_UI_HOST || '0.0.0.0';
const PORT = Number(process.env.MKVIDEOS_UI_PORT || 5178);

const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const VID_EXT = new Set(['.mp4', '.webm', '.mov']);
const TXT_EXT = new Set(['.json', '.md', '.txt', '.log']);
const SERVABLE = new Set([...IMG_EXT, ...VID_EXT, ...TXT_EXT, '.html', '.css', '.js']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

const tryStat = (p) => { try { return fs.statSync(p); } catch { return null; } };
const tryReadDir = (p) => { try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; } };
const tryReadJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const tryReadText = (p, max = 8000) => { try { return fs.readFileSync(p, 'utf8').slice(0, max); } catch { return ''; } };
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const safeResolve = (root, sub) => {
  const r = path.resolve(root, sub || '.');
  if (r !== root && !r.startsWith(root + path.sep)) return null;
  return r;
};
const fileUrl = (abs) => `/file?path=${encodeURIComponent(rel(abs))}`;

function countFiles(dir, predicate) {
  const stat = tryStat(dir);
  if (!stat || !stat.isDirectory()) return 0;
  let n = 0;
  for (const entry of tryReadDir(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countFiles(full, predicate);
    else if (predicate(full)) n += 1;
  }
  return n;
}

function findFiles(dir, predicate, limit = 12, depth = 2) {
  const out = [];
  const stat = tryStat(dir);
  if (!stat || !stat.isDirectory()) return out;
  const walk = (d, lvl) => {
    if (out.length >= limit || lvl > depth) return;
    for (const entry of tryReadDir(d)) {
      if (out.length >= limit) return;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full, lvl + 1);
      else if (predicate(full)) out.push(full);
    }
  };
  walk(dir, 0);
  return out;
}

function scanCampaign(projectName, campaignDir) {
  const stat = tryStat(campaignDir);
  const payload = tryReadJson(path.join(campaignDir, 'campaign_payload.json'));
  const adsDir = path.join(campaignDir, 'ads');
  const imgsDir = path.join(campaignDir, 'imgs');
  const videoDir = path.join(campaignDir, 'video');
  const logsDir = path.join(campaignDir, 'logs');

  const isImg = (f) => IMG_EXT.has(path.extname(f).toLowerCase());
  const isVid = (f) => VID_EXT.has(path.extname(f).toLowerCase());

  const ads = findFiles(adsDir, isImg, 200, 2).map((p) => ({ name: path.basename(p), url: fileUrl(p) }));
  const imgs = findFiles(imgsDir, isImg, 200, 2).map((p) => ({ name: path.basename(p), url: fileUrl(p) }));
  const videos = findFiles(videoDir, isVid, 50, 2).map((p) => ({ name: path.basename(p), url: fileUrl(p) }));

  // Report: pasta opcional com 1 vídeo principal + carousels (formato relatório).
  const reportDir = path.join(campaignDir, 'report');
  let report = null;
  if (tryStat(reportDir)?.isDirectory()) {
    const rAds = findFiles(reportDir, isImg, 30, 1).map((p) => ({ name: path.basename(p), url: fileUrl(p) }));
    const rVids = findFiles(reportDir, isVid, 5, 1).map((p) => ({ name: path.basename(p), url: fileUrl(p) }));
    if (rAds.length || rVids.length) report = { ads: rAds, videos: rVids };
  }

  // Gatilhos: cada subpasta de gatilhos/ é um hook independente com video.mp4 + carousels.
  const gatilhosDir = path.join(campaignDir, 'gatilhos');
  const gatilhos = tryReadDir(gatilhosDir)
    .filter((e) => e.isDirectory())
    .map((e) => {
      const gDir = path.join(gatilhosDir, e.name);
      const gAds = findFiles(gDir, isImg, 20, 1).map((p) => ({ name: path.basename(p), url: fileUrl(p) }));
      const gVids = findFiles(gDir, isVid, 4, 1).map((p) => ({ name: path.basename(p), url: fileUrl(p) }));
      return { slug: e.name, ads: gAds, videos: gVids };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const publishMd = findFiles(campaignDir, (f) => /^Publish .+\.md$/i.test(path.basename(f)), 1, 1)[0];
  const interactiveReport = path.join(campaignDir, 'interactive_report.html');

  const HIDDEN = new Set(['task_name', 'task_date', 'project_dir', 'output_dir', 'campaign_brief', 'description', 'brief']);
  const params = payload && typeof payload === 'object'
    ? Object.fromEntries(Object.entries(payload).filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)))
    : {};

  return {
    id: `${projectName}/${path.basename(campaignDir)}`,
    project: projectName,
    name: path.basename(campaignDir),
    task_name: payload?.task_name || path.basename(campaignDir),
    task_date: payload?.task_date || '',
    brief: payload?.campaign_brief || payload?.description || payload?.brief || '',
    platforms: Array.isArray(payload?.platform_targets) ? payload.platform_targets : [],
    image_formats: Array.isArray(payload?.image_formats) ? payload.image_formats : [],
    video_template: payload?.video_template || null,
    skip: {
      research: !!payload?.skip_research,
      image: !!payload?.skip_image,
      video: !!payload?.skip_video,
    },
    params,
    counts: {
      ads: countFiles(adsDir, isImg),
      imgs: countFiles(imgsDir, isImg),
      videos: countFiles(videoDir, isVid),
      logs: countFiles(logsDir, (f) => /\.(log|out)$/i.test(f)),
      gatilhos: gatilhos.length,
      report: report ? 1 : 0,
    },
    ads,
    imgs,
    videos,
    gatilhos,
    report,
    files: {
      payload: tryStat(path.join(campaignDir, 'campaign_payload.json')) ? rel(path.join(campaignDir, 'campaign_payload.json')) : null,
      report: tryStat(interactiveReport) ? rel(interactiveReport) : null,
      publish: publishMd ? rel(publishMd) : null,
    },
    updatedAt: stat ? stat.mtime.toISOString() : null,
  };
}

function listCampaigns() {
  const projects = tryReadDir(PRJ_DIR).filter((e) => e.isDirectory()).map((e) => e.name);
  const all = [];
  for (const proj of projects) {
    const outputs = path.join(PRJ_DIR, proj, 'outputs');
    for (const entry of tryReadDir(outputs)) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      all.push(scanCampaign(proj, path.join(outputs, entry.name)));
    }
  }
  all.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return { projects, campaigns: all };
}

// Mapa estático: descrição de cada tipo de vídeo + worker que gera.
// Usado pela UI pra explicar o que cada tipo faz.
const VIDEO_TYPE_INFO = {
  'criaprof': {
    title: 'CriaProf — Criança → Profissional',
    summary: 'Jornada visual da infância (anos 1980) até profissional do futuro. Vídeo 1:1 ou 9:16, 45s.',
    codeFile: 'gen-criaprof.js',
    promptFile: 'gen-lib/scene-templates.js',
    gen: { script: 'gen-criaprof.js', usage: 'node gen-criaprof.js <slug>',
      desc: 'Factory: lê config/profissoes-30.js + gen-lib/scene-templates.criaProfScenes(); gera 50 imgs (25 cenas × ini+fim) via inemaimg API.' },
    render: { script: 'render-criaprof.js', usage: 'node render-criaprof.js <slug>',
      desc: 'Monta vídeo 1080×1080 45s: Ken Burns + zoom 0.0022 nas 50 imgs, narração+música, captions whisper-sync (y=940), watermark INEMA.CLUB final.' },
    extras: [
      { script: 'render-criaprof-916.js', desc: 'Variante 9:16 1080×1920 com bandas pretas top/bottom e captions estilo GERTRAN (y=1520).' },
    ],
  },
  'gertran': {
    title: 'GERTRAN — Geração da Transformação',
    summary: 'Reels 9:16 31s para público 35+: "Você sempre se adaptou. Faça de novo com IA."',
    codeFile: 'render-gertran.js',
    promptFile: 'gen-gertran-nostalgia.js',
    gen: { script: 'gen-gertran-nostalgia.js', usage: 'node gen-gertran-nostalgia.js <slug>',
      desc: 'Factory: gera 20 imgs era-específicas por profissão (input do render).' },
    render: { script: 'render-gertran.js', usage: 'node render-gertran.js <slug>',
      desc: '31s = 3s padding (bg sólido + PROFISSÃO 150pt + hook 4 linhas + INEMA.CLUB topo/rodapé) + 25s main (20 imgs com scale Lanczos sem tremor, captions whisper-sync y=1520) + 3s black outro (CTA INEMA.CLUB 180pt).' },
  },
  'paired': {
    title: 'Paired — Mudanças no tempo',
    summary: 'Reels 9:16 31s: 50 imgs em pares antes/depois (par01a/par01b...) mostrando como cada profissão evoluiu.',
    codeFile: 'gen-extra.js',
    promptFile: 'gen-lib/scene-templates.js',
    gen: { script: 'gen-extra.js', usage: 'node gen-extra.js <slug> paired',
      desc: 'Factory genérica que reusa pairedChangesScenes() do gen-lib/scene-templates.' },
    render: { script: 'render-extra.js', usage: 'node render-extra.js <slug> paired',
      desc: 'Layout dos templates extras: 3s padding (label + hook) + 25s main (50 imgs × 0.5s) + 3s black outro. Estilo GERTRAN.' },
  },
  'decades': {
    title: 'Decades — Linha do tempo por décadas',
    summary: 'Reels 9:16 31s mostrando a evolução da profissão por décadas (50 imgs dec01..dec50).',
    codeFile: 'gen-extra.js',
    promptFile: 'gen-lib/scene-templates.js',
    gen: { script: 'gen-extra.js', usage: 'node gen-extra.js <slug> decades',
      desc: 'Factory genérica que reusa decadeTimelineScenes() do gen-lib/scene-templates.' },
    render: { script: 'render-extra.js', usage: 'node render-extra.js <slug> decades',
      desc: 'Mesmo layout dos templates extras (3+25+3s, estilo GERTRAN).' },
  },
  'artifacts': {
    title: 'Artifacts — Linha do tempo dos objetos',
    summary: 'Reels 9:16 31s mostrando os objetos/ferramentas que marcaram a profissão (50 imgs art01..art50).',
    codeFile: 'gen-extra.js',
    promptFile: 'gen-lib/scene-templates.js',
    gen: { script: 'gen-extra.js', usage: 'node gen-extra.js <slug> artifacts',
      desc: 'Factory genérica via artifactTimelineScenes().' },
    render: { script: 'render-extra.js', usage: 'node render-extra.js <slug> artifacts',
      desc: 'Mesmo layout dos templates extras.' },
  },
  'inema': {
    title: 'INEMA — Vídeos institucionais autorais',
    summary: 'Vídeos conceituais autorais 1080×1080 60s. Ken Burns + crossfade + música.',
    codeFile: 'render-eu-vi-o-futuro.js',
    promptFile: 'gen-eu-vi-o-futuro.js',
    gen: { script: 'gen-eu-vi-o-futuro.js / gen-antes-do-futuro.js',
      desc: 'Scripts dedicados (não factory) — geram imgs específicas pra cada conceito.' },
    render: { script: 'render-eu-vi-o-futuro.js / render-antes-do-futuro.js',
      desc: '20 cenas × 3s = 60s. Cada cena = ini(1.5s) + fim(1.5s) com zoompan, fade out final.' },
  },
  'criaprof-cta-916': {
    title: 'CriaProf-CTA 9:16',
    summary: 'Variante CTA do CriaProf: 9:16 37s com HOOK forte 0-3s + CTA pesado 33-37s. 2 variantes (prof / generic).',
    codeFile: 'render-criaprof-cta-916.js',
    promptFile: 'batch-criaprof-cta.js',
    gen: { script: '— (reusa imgs do CriaProf)',
      desc: 'Não regera imgs. Reaproveita output/videos/criaprof/<slug>_<date>/imgs/. batch-criaprof-cta.js gera a narração nova com hook prepend.' },
    render: { script: 'render-criaprof-cta-916.js', usage: 'node render-criaprof-cta-916.js <slug> <prof|generic>',
      desc: 'Mesmo zoompan do CriaProf, mas formato 9:16 + faixas top/bottom + CTA final pesado.' },
  },
  'criaprof-comic-A': {
    title: 'CriaProf Comic A — Calvin & Hobbes',
    summary: 'Mesma narrativa do CriaProf (50 imgs, 25 cenas × ini+fim) com estilo Calvin & Hobbes.',
    codeFile: 'gen-criaprof-comic-A.js',
    promptFile: 'gen-criaprof-comic-A.js',
    gen: { script: 'gen-criaprof-comic-A.js', usage: 'node gen-criaprof-comic-A.js <slug>',
      desc: 'Substitui as constantes S_OLD/S_MID/S_FUT pelo prompt suffix COMIC_A (newspaper comic strip + watercolor + linework). Único gen que usa getDiverseProfile().' },
    render: { script: 'render-criaprof-comic-A-cta-916.js', usage: 'node render-criaprof-comic-A-cta-916.js <slug> <prof|generic>',
      desc: 'Mesmo render do CriaProf-CTA-916 mas lendo as imgs do comic-A. Reusa TTS+Whisper.' },
  },
  'gertran-nostalgia': {
    title: 'GERTRAN nostalgia — pasta de assets',
    summary: 'Pasta de assets (imgs era-específicas) consumida pelo render-gertran.js. Não tem vídeos próprios.',
    codeFile: 'gen-gertran-nostalgia.js',
    promptFile: 'gen-gertran-nostalgia.js',
    gen: { script: 'gen-gertran-nostalgia.js', usage: 'node gen-gertran-nostalgia.js <slug>',
      desc: 'Gera 20 imgs era-específicas por profissão.' },
  },
  'darkstory': {
    title: 'DarkStory — Histórias para canal dark do YouTube',
    summary: 'Gera vídeo longo a partir de um título/assunto. LLM cria roteiro + prompts visuais sombrios; inemaimg gera N imgs; ffmpeg + Chatterbox TTS + whisper ASS compõem o vídeo. Defaults: 60s · 12 imgs · voz josh · captions on · 9:16 · trilha dark.',
    codeFile: 'gen-darkstory.js',
    promptFile: 'render-darkstory.js',
    gen: { script: 'gen-darkstory.js',
      usage: 'node gen-darkstory.js --titulo "<assunto>" [--duracao 60] [--n_imgs 12] [--voz josh] [--captions] [--formato 9:16] [--musica dark]',
      desc: 'STATUS: SKELETON. Hoje só cria a pasta + meta.json. Falta: chamar Claude CLI pra gerar scene_plan.json (cenas com narração + prompt visual) e loopar inemaimg pra gerar as N imgs. Padrão: gen-criaprof-comic-A.js.' },
    render: { script: 'render-darkstory.js',
      usage: 'node render-darkstory.js <slug>_<date>',
      desc: 'STATUS: SKELETON. Vai usar Chatterbox TTS (default voz josh) + whisper word-level captions + ffmpeg Ken Burns + música dark de fundo. Padrão: render-criaprof.js (1080×1920 com Ken Burns + ASS captions y=1520).' },
  },
};

// Lista vídeos standalone (factory CLI) em prj/<proj>/videos/<kind>/...
// Cada subpasta direta dentro de videos/<kind>/ é tratada como subgrupo (slug+data).
// Subpastas com nome "videos" ou "video" são tratadas como pool comum de mp4s renderizados.
function listVideoTypes() {
  const groups = [];
  const isVid = (f) => VID_EXT.has(path.extname(f).toLowerCase());
  const isImg = (f) => IMG_EXT.has(path.extname(f).toLowerCase());

  if (!tryStat(OUTPUT_VIDEOS_DIR)?.isDirectory()) {
    return { projects: [], groups: [] };
  }

  for (const kindEntry of tryReadDir(OUTPUT_VIDEOS_DIR)) {
    if (!kindEntry.isDirectory()) continue;
    const kindDir = path.join(OUTPUT_VIDEOS_DIR, kindEntry.name);

    // Pool global de vídeos (mp4 em qualquer profundidade até 3).
    const allVideos = findFiles(kindDir, isVid, 5000, 3).map((p) => ({
      name: path.basename(p),
      relDir: path.relative(kindDir, path.dirname(p)).split(path.sep).join('/') || '.',
      url: fileUrl(p),
    }));

    // Subdirs por slug (ignora pastas "videos"/"video" que são pool comum).
    const slugs = [];
    for (const sub of tryReadDir(kindDir)) {
      if (!sub.isDirectory()) continue;
      if (/^videos?$/i.test(sub.name)) continue;
      const slugDir = path.join(kindDir, sub.name);
      const imgsDir = path.join(slugDir, 'imgs');
      const imgs = (tryStat(imgsDir)?.isDirectory()
        ? findFiles(imgsDir, isImg, 100, 1)
        : findFiles(slugDir, isImg, 100, 1)
      ).map((p) => ({ name: path.basename(p), url: fileUrl(p) }));
      const slugVids = findFiles(slugDir, isVid, 20, 2).map((p) => ({ name: path.basename(p), url: fileUrl(p) }));
      const hasMeta = tryStat(path.join(slugDir, 'meta.json')) ? true : false;
      if (imgs.length === 0 && slugVids.length === 0 && !hasMeta) continue;
      slugs.push({ slug: sub.name, imgs, videos: slugVids, imgCount: imgs.length, hasMeta });
    }
    slugs.sort((a, b) => a.slug.localeCompare(b.slug));

    // Para slugs sem vídeo inline, tenta casar no pool por prefixo (ex: "administrador_…" → "administrador-paired-31s.mp4").
    for (const s of slugs) {
      if (s.videos.length > 0) continue;
      const prof = s.slug.split('_')[0].toLowerCase();
      const matched = allVideos.find((v) => v.name.toLowerCase().startsWith(prof + '-') || v.name.toLowerCase().startsWith(prof + '_'));
      if (matched) s.videos = [matched];
    }

    if (allVideos.length === 0 && slugs.length === 0 && !VIDEO_TYPE_INFO[kindEntry.name]) continue;

    const stat = tryStat(kindDir);
    groups.push({
      kind: kindEntry.name,
      info: VIDEO_TYPE_INFO[kindEntry.name] || null,
      videoCount: allVideos.length,
      slugCount: slugs.length,
      videos: allVideos.slice(0, 800),
      slugs,
      updatedAt: stat ? stat.mtime.toISOString() : null,
    });
  }

  groups.sort((a, b) => b.videoCount - a.videoCount);
  return { projects: [], groups };
}

function getConfig() {
  const pkg = tryReadJson(path.join(ROOT, 'package.json')) || {};
  const claudeMdHead = tryReadText(path.join(ROOT, 'CLAUDE.md'), 4000);

  const skills = tryReadDir(path.join(ROOT, 'skills'))
    .filter((e) => e.isDirectory())
    .map((e) => {
      const skillFile = path.join(ROOT, 'skills', e.name, 'SKILL.md');
      const head = tryReadText(skillFile, 600);
      const firstLine = head.split('\n').find((l) => l.trim() && !l.startsWith('#')) || '';
      return { name: e.name, hasSkillMd: tryStat(skillFile) ? true : false, summary: firstLine.trim().slice(0, 200) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const projectKnowledge = tryReadDir(PRJ_DIR)
    .filter((e) => e.isDirectory())
    .map((e) => {
      const knowDir = path.join(PRJ_DIR, e.name, 'knowledge');
      const files = tryReadDir(knowDir)
        .filter((f) => f.isFile() && /\.md$/i.test(f.name))
        .map((f) => f.name);
      return { project: e.name, files };
    });

  return {
    version: pkg.version || '?',
    name: pkg.name || 'mkvideos',
    displayName: pkg.displayName || 'mkVIDEOS',
    nodeVersion: process.version,
    rootPath: ROOT,
    dependencies: Object.keys(pkg.dependencies || {}).sort(),
    scripts: pkg.scripts || {},
    claudeMdHead,
    skills,
    projectKnowledge,
  };
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function serveStatic(req, res) {
  const reqPath = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
  const target = safeResolve(PUBLIC_DIR, reqPath.slice(1));
  if (!target || !tryStat(target)) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = path.extname(target).toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(target).pipe(res);
}

function serveFile(req, res, url) {
  const requested = url.searchParams.get('path') || '';
  const target = safeResolve(ROOT, requested);
  if (!target || !tryStat(target)) { res.writeHead(404); res.end('not found'); return; }
  const ext = path.extname(target).toLowerCase();
  if (!SERVABLE.has(ext)) { res.writeHead(415); res.end('unsupported type'); return; }
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(target).pipe(res);
}

function handleApi(req, res, url) {
  if (req.method !== 'GET') { sendJson(res, { error: 'read-only ui' }, 405); return; }
  if (url.pathname === '/api/campaigns') return sendJson(res, listCampaigns());
  if (url.pathname === '/api/videos') return sendJson(res, listVideoTypes());
  if (url.pathname === '/api/config') return sendJson(res, getConfig());
  sendJson(res, { error: 'not found' }, 404);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
    if (url.pathname === '/file') return serveFile(req, res, url);
    return serveStatic(req, res);
  } catch (err) {
    res.writeHead(500); res.end(String(err.message || err));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`mkvideos UI (read-only) → http://${HOST}:${PORT}`);
  console.log(`  GET /api/campaigns  · GET /api/videos  · GET /api/config  · GET /file?path=...`);
});
