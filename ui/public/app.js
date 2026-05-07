// mkVIDEOS UI — read-only client.

const STORE_KEY = 'mkvideos-ui-state';

// Versão exibida no formato v<major>.<features>.<bugs> com features/bugs zero-padded em 2 dígitos.
// Ambos contadores só resetam quando major sobe (v1 → v2).
function formatVersion(v) {
  const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return `v${v || '?'}`;
  const [, major, features, bugs] = m;
  return `v${major}.${String(features).padStart(2, '0')}.${String(bugs).padStart(2, '0')}`;
}
const stored = (() => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; }
})();

const state = {
  campaigns: [],
  videoGroups: [],
  activeVideoKind: stored.activeVideoKind || null,  // null = tela geral; senão kind ativo
  projects: [],
  config: null,
  filter: { search: '', project: stored.project || '' },
  view: stored.view || 'videos',
};

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      project: state.filter.project,
      view: state.view,
      activeVideoKind: state.activeVideoKind,
    }));
  } catch { /* ignore quota */ }
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

const VIEW_TITLES = { campaigns: 'Campanhas', videos: 'Estúdio', config: 'Config' };

function setView(v) {
  state.view = v;
  persist();
  $$('.nav-item').forEach((b) => b.classList.toggle('is-active', b.dataset.view === v));
  $$('.view').forEach((s) => s.classList.toggle('is-active', s.id === `view${v.charAt(0).toUpperCase() + v.slice(1)}`));
  $('#viewTitle').textContent = VIEW_TITLES[v] || v;
  if (v === 'config' && !state.config) loadConfig();
  if (v === 'campaigns') {
    if (!state.campaigns.length) loadCampaigns();
    else renderCampaigns();
  }
  if (v === 'videos') {
    if (!state.videoGroups.length) loadVideos();
    else renderVideoTypes();
  }
  renderVideoSubnav();
}

function applyFilter(camps) {
  const s = state.filter.search.toLowerCase().trim();
  const p = state.filter.project;
  return camps.filter((c) => {
    if (p && c.project !== p) return false;
    if (!s) return true;
    return (
      c.name.toLowerCase().includes(s) ||
      c.task_name.toLowerCase().includes(s) ||
      c.task_date.toLowerCase().includes(s) ||
      c.project.toLowerCase().includes(s)
    );
  });
}

function renderStats(camps) {
  const totals = camps.reduce(
    (acc, c) => {
      acc.ads += c.counts.ads;
      acc.imgs += c.counts.imgs;
      acc.videos += c.counts.videos;
      return acc;
    },
    { ads: 0, imgs: 0, videos: 0 },
  );
  $('#campaignStats').innerHTML = `
    <div class="stat"><div class="label">Campanhas</div><div class="value">${camps.length}</div></div>
    <div class="stat"><div class="label">Projetos</div><div class="value">${state.projects.length}</div></div>
    <div class="stat"><div class="label">Ads (PNG)</div><div class="value">${totals.ads}</div></div>
    <div class="stat"><div class="label">Imgs API</div><div class="value">${totals.imgs}</div></div>
    <div class="stat"><div class="label">Vídeos</div><div class="value">${totals.videos}</div></div>
  `;
}

function previewCell(items, i) {
  const p = items[i];
  if (!p) return '<div class="empty">—</div>';
  return lbThumbHTML(items, i);
}

function previewRow(items, key) {
  if (key) registerLb(key, items);
  const slots = [0, 1, 2, 3].map((i) => previewCell(items, i));
  return `<div class="preview-row">${slots.join('')}</div>`;
}

// Renderiza um chip "label: value" com cor por tipo (bool, default, custom).
function chip(label, value, kind = 'val') {
  return `<span class="pchip pchip-${kind}"><span class="pchip-k">${escapeHtml(label)}</span><span class="pchip-v">${escapeHtml(String(value))}</span></span>`;
}
function chipBool(label, on) {
  return `<span class="pchip pchip-${on ? 'on' : 'off'}"><span class="pchip-k">${escapeHtml(label)}</span><span class="pchip-v">${on ? 'sim' : 'não'}</span></span>`;
}

function renderParams(c) {
  const p = c.params || {};
  const sections = [];

  // ── IMAGEM ──
  const imgChips = [];
  if (p.image_count) imgChips.push(chip('qtd', p.image_count));
  if (p.image_formats?.length) imgChips.push(...p.image_formats.map((f) => chip('formato', f)));
  if (p.image_source) imgChips.push(chip('fonte', p.image_source, p.image_source === 'api' ? 'accent' : 'val'));
  if (p.image_model) imgChips.push(chip('modelo', p.image_model, 'accent'));
  if (p.image_background_color) imgChips.push(chip('bg', p.image_background_color));
  if ('use_brand_overlay' in p) imgChips.push(chipBool('overlay marca', p.use_brand_overlay));
  if (imgChips.length) sections.push({ label: 'imagem', chips: imgChips });

  // ── VÍDEO ──
  const vidChips = [];
  if (p.video_count) vidChips.push(chip('qtd', p.video_count));
  if (p.video_mode) vidChips.push(chip('modo', p.video_mode, 'accent'));
  else if (p.video_quick && p.video_pro) vidChips.push(chip('modo', 'quick+pro', 'accent'));
  else if (p.video_pro) vidChips.push(chip('modo', 'pro', 'accent'));
  else if (p.video_quick) vidChips.push(chip('modo', 'quick', 'accent'));
  if (p.video_template) vidChips.push(chip('template', p.video_template, 'accent'));
  if (p.video_audio) vidChips.push(chip('áudio', p.video_audio));
  if (p.tts_provider) vidChips.push(chip('tts', p.tts_provider));
  if (p.voice) vidChips.push(chip('voz', p.voice));
  if (p.style_preset) vidChips.push(chip('preset', p.style_preset));
  if (p.photo_quality) vidChips.push(chip('photo', p.photo_quality));
  if (vidChips.length) sections.push({ label: 'vídeo', chips: vidChips });

  // ── PLATAFORMA / IDIOMA ──
  const platChips = [];
  if (p.platform_targets?.length) platChips.push(...p.platform_targets.map((t) => chip('plat', t, 'accent')));
  if (p.language) platChips.push(chip('idioma', p.language));
  if (platChips.length) sections.push({ label: 'distribuição', chips: platChips });

  // ── APROVAÇÃO ──
  if (p.approval_modes && typeof p.approval_modes === 'object') {
    const stages = Object.entries(p.approval_modes);
    const allSame = stages.every(([, v]) => v === stages[0][1]);
    const apvChips = allSame
      ? [chip('todas etapas', stages[0][1], stages[0][1] === 'auto' ? 'on' : stages[0][1] === 'humano' ? 'warn' : 'val')]
      : stages.map(([k, v]) => chip(k, v, v === 'auto' ? 'on' : v === 'humano' ? 'warn' : 'val'));
    sections.push({ label: 'aprovação', chips: apvChips });
  }

  // ── SKIP ──
  const skipChips = [];
  if (p.skip_research) skipChips.push(chip('skip', 'research', 'off'));
  if (p.skip_image) skipChips.push(chip('skip', 'imagem', 'off'));
  if (p.skip_video) skipChips.push(chip('skip', 'vídeo', 'off'));
  if (skipChips.length) sections.push({ label: 'pulado', chips: skipChips });

  // ── OUTROS (qualquer chave que sobrou) ──
  const RENDERED = new Set([
    'image_count','image_formats','image_source','image_model','image_background_color','use_brand_overlay',
    'video_count','video_mode','video_quick','video_pro','video_template','video_audio','tts_provider','voice','style_preset','photo_quality',
    'platform_targets','language',
    'approval_modes',
    'skip_research','skip_image','skip_video',
    'notifications',
  ]);
  const extras = Object.entries(p).filter(([k]) => !RENDERED.has(k));
  if ('notifications' in p) {
    sections.push({ label: 'config', chips: [chipBool('notif', p.notifications)] });
  }
  if (extras.length) {
    const xc = extras.map(([k, v]) => {
      const val = Array.isArray(v) ? v.join(', ') : (typeof v === 'object' && v) ? JSON.stringify(v) : String(v);
      return chip(k, val);
    });
    sections.push({ label: 'extra', chips: xc });
  }

  if (!sections.length) return '';
  const html = sections.map((s) =>
    `<div class="pgroup">
       <span class="pgroup-label">${escapeHtml(s.label)}</span>
       <div class="pgroup-chips">${s.chips.join('')}</div>
     </div>`
  ).join('');
  return `<div class="card-params-vis">${html}</div>`;
}

function campaignCard(c) {
  const skipTags = [
    c.skip.research ? '<span class="tag warn">skip research</span>' : '',
    c.skip.image ? '<span class="tag warn">skip image</span>' : '',
    c.skip.video ? '<span class="tag warn">skip video</span>' : '',
  ].join('');
  const fmts = c.image_formats.length ? c.image_formats.map((f) => `<span class="tag">${escapeHtml(f)}</span>`).join('') : '';
  const tplTag = c.video_template ? `<span class="tag">tpl: ${escapeHtml(c.video_template)}</span>` : '';
  const platTags = c.platforms.map((p) => `<span class="tag">${escapeHtml(p)}</span>`).join('');
  const imgsPreview = (c.imgs || []).slice(0, 4);
  const adsPreview = (c.ads || []).slice(0, 4);

  const actions = [];
  if (c.ads.length) actions.push(`<button data-action="ads" data-id="${escapeHtml(c.id)}" data-name="${escapeHtml(c.name)}">${c.ads.length} ads</button>`);
  if (c.imgs.length) actions.push(`<button data-action="imgs" data-id="${escapeHtml(c.id)}" data-name="${escapeHtml(c.name)}">${c.imgs.length} imgs</button>`);
  if (c.videos.length) actions.push(`<button data-action="videos" data-id="${escapeHtml(c.id)}" data-name="${escapeHtml(c.name)}">${c.videos.length} vídeos</button>`);
  if (c.gatilhos?.length) actions.push(`<button data-action="gatilhos" data-id="${escapeHtml(c.id)}" data-name="${escapeHtml(c.name)}">${c.gatilhos.length} gatilhos</button>`);
  if (c.report) actions.push(`<button data-action="report" data-id="${escapeHtml(c.id)}" data-name="${escapeHtml(c.name)}">ReportVd</button>`);
  if (c.files.payload) actions.push(`<button data-action="payload" data-path="${encodeURIComponent(c.files.payload)}" data-name="${escapeHtml(c.name)}">payload</button>`);
  if (c.files.publish) actions.push(`<button data-action="publish" data-path="${encodeURIComponent(c.files.publish)}" data-name="${escapeHtml(c.name)}">publish.md</button>`);
  if (c.files.report) actions.push(`<a href="/file?path=${encodeURIComponent(c.files.report)}" target="_blank" rel="noopener">ReportHTML</a>`);

  const briefBlock = c.brief
    ? `<p class="card-brief">${escapeHtml(c.brief)}</p>`
    : '';

  const paramsBlock = renderParams(c);

  return `
    <article class="card" data-id="${escapeHtml(c.id)}">
      <header class="card-head">
        <div>
          <div class="project">${escapeHtml(c.project)}</div>
          <h3>${escapeHtml(c.name)}</h3>
        </div>
        <small style="color:var(--text-dim)">${escapeHtml(c.task_date || '')}</small>
      </header>
      ${imgsPreview.length ? `<div class="preview-label">imgs</div>${previewRow(c.imgs.slice(0, 4), `${c.id}::imgs-preview`)}` : ''}
      ${briefBlock}
      ${adsPreview.length ? `<div class="preview-label">ads</div>${previewRow(c.ads.slice(0, 4), `${c.id}::ads-preview`)}` : ''}
      <div class="counts">
        <span class="count-chip"><strong>${c.counts.ads}</strong> ads</span>
        <span class="count-chip"><strong>${c.counts.imgs}</strong> imgs</span>
        <span class="count-chip"><strong>${c.counts.videos}</strong> vídeos</span>
        ${c.counts.gatilhos ? `<span class="count-chip"><strong>${c.counts.gatilhos}</strong> gatilhos</span>` : ''}
        ${c.report ? `<span class="count-chip">ReportVd</span>` : ''}
        <span class="count-chip"><strong>${c.counts.logs}</strong> logs</span>
      </div>
      <div class="card-meta">
        ${platTags}${fmts}${tplTag}${skipTags}
      </div>
      ${paramsBlock}
      <small style="color:var(--text-dim)">atualizado ${fmtDate(c.updatedAt)}</small>
      <div class="card-actions">${actions.join('')}</div>
    </article>
  `;
}

function renderCampaigns() {
  const filtered = applyFilter(state.campaigns);
  renderStats(filtered);
  if (!filtered.length) {
    $('#campaignList').innerHTML = '<div class="empty-state">nenhuma campanha bate com o filtro</div>';
    return;
  }
  $('#campaignList').innerHTML = filtered.map(campaignCard).join('');
}

function renderConfig() {
  const c = state.config;
  if (!c) return;
  $('#brandVersion').textContent = formatVersion(c.version);
  const skills = c.skills.map((s) => `
    <div class="item">
      <strong>${escapeHtml(s.name)}</strong>
      <small>${escapeHtml(s.summary || '(sem resumo)')}</small>
    </div>`).join('');

  const knowledge = c.projectKnowledge.map((p) => `
    <div class="item">
      <strong>${escapeHtml(p.project)}</strong>
      <small>${p.files.length ? p.files.map(escapeHtml).join(', ') : '(sem knowledge/)'}</small>
    </div>`).join('');

  const scripts = Object.entries(c.scripts).map(([k, v]) => `<div><strong>${escapeHtml(k)}</strong>: <code>${escapeHtml(v)}</code></div>`).join('');
  const deps = c.dependencies.map((d) => `<span class="tag">${escapeHtml(d)}</span>`).join('');

  $('#configGrid').innerHTML = `
    <div class="config-card">
      <h3>projeto</h3>
      <dl class="kv">
        <dt>nome</dt><dd>${escapeHtml(c.displayName || c.name)}</dd>
        <dt>versão</dt><dd>${escapeHtml(formatVersion(c.version))}</dd>
        <dt>node</dt><dd>${escapeHtml(c.nodeVersion)}</dd>
        <dt>root</dt><dd><code>${escapeHtml(c.rootPath)}</code></dd>
      </dl>
    </div>
    <div class="config-card">
      <h3>dependências (${c.dependencies.length})</h3>
      <div class="dep-list">${deps}</div>
    </div>
    <div class="config-card" style="grid-column: 1 / -1;">
      <h3>scripts</h3>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;">${scripts}</div>
    </div>
    <div class="config-card">
      <h3>skills (${c.skills.length})</h3>
      <div class="skill-list">${skills || '(nenhuma)'}</div>
    </div>
    <div class="config-card">
      <h3>knowledge por projeto</h3>
      <div class="knowledge-list">${knowledge || '(nenhum)'}</div>
    </div>
    <div class="config-card" style="grid-column: 1 / -1;">
      <h3>CLAUDE.md (head)</h3>
      <pre>${escapeHtml(c.claudeMdHead)}</pre>
    </div>
  `;
}

// ── Lightbox ─────────────────────────────────────────────────────────────────
const lb = { items: [], idx: 0 };
function openLightbox(items, idx = 0) {
  if (!items?.length) return;
  lb.items = items;
  lb.idx = Math.max(0, Math.min(idx, items.length - 1));
  $('#lightbox').classList.toggle('is-single', items.length === 1);
  renderLightbox();
  $('#lightbox').hidden = false;
}
function renderLightbox() {
  const it = lb.items[lb.idx];
  if (!it) return;
  $('#lbImg').src = it.url;
  $('#lbImg').alt = it.name || '';
  $('#lbCaption').textContent = `${it.name || ''}  (${lb.idx + 1}/${lb.items.length})`;
}
function lbStep(delta) {
  if (!lb.items.length) return;
  lb.idx = (lb.idx + delta + lb.items.length) % lb.items.length;
  renderLightbox();
}
function closeLightbox() { $('#lightbox').hidden = true; $('#lbImg').src = ''; }

// Helper: gera <img> com data-* pra integração com o handler de cliques.
function lbThumbHTML(items, idx, classes = '') {
  const it = items[idx];
  return `<img loading="lazy" src="${it.url}" alt="${escapeHtml(it.name)}" title="${escapeHtml(it.name)}"
    class="${classes}" data-lb="1" data-lb-key="${escapeHtml(items._key || '')}" data-lb-idx="${idx}" />`;
}

// Mantém referência aos itens por chave (id da campanha + tipo).
const lbBundles = new Map();
function registerLb(key, items) {
  items._key = key;
  lbBundles.set(key, items);
  return items;
}

function openModal(title, html) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modal').hidden = false;
}

function closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; }

async function showCodeFile(path, label) {
  try {
    const r = await fetch(`/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    openModal(label, `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">
        <small style="color:var(--text-dim);font-size:11px;"><code>${escapeHtml(path)}</code> · ${text.split('\n').length} linhas · ${(text.length / 1024).toFixed(1)} KB</small>
        <a href="/file?path=${encodeURIComponent(path)}" target="_blank" rel="noopener" class="toggle-btn">abrir nova aba</a>
      </div>
      <pre class="code-pre">${escapeHtml(text)}</pre>
    `);
  } catch (err) {
    openModal(label, `<pre>erro ao abrir: ${escapeHtml(err.message)}</pre>`);
  }
}

async function showFile(path, title) {
  try {
    const r = await fetch(`/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' });
    const text = await r.text();
    if (path.endsWith('.json')) {
      try { openModal(title, `<pre>${escapeHtml(JSON.stringify(JSON.parse(text), null, 2))}</pre>`); return; }
      catch { /* fall through */ }
    }
    openModal(title, `<pre>${escapeHtml(text)}</pre>`);
  } catch (err) {
    openModal(title, `<pre>erro: ${escapeHtml(err.message)}</pre>`);
  }
}

function showVideos(campaignId, name) {
  const c = state.campaigns.find((x) => x.id === campaignId);
  if (!c) return;
  const html = c.videos.map((v) =>
    `<div><h4 style="font-size:12px;margin:6px 0;">${escapeHtml(v.name)}</h4><video controls preload="metadata" src="${v.url}"></video></div>`
  ).join('');
  openModal(`vídeos — ${name}`, `<div class="video-row">${html}</div>`);
}

function showReport(campaignId, name) {
  const c = state.campaigns.find((x) => x.id === campaignId);
  if (!c?.report) return;
  const r = c.report;
  const vids = r.videos.map((v) =>
    `<div><h4 style="font-size:12px;margin:6px 0;">${escapeHtml(v.name)}</h4><video controls preload="metadata" src="${v.url}"></video></div>`
  ).join('');
  const key = `${campaignId}::report`;
  registerLb(key, r.ads);
  const ads = r.ads.map((_, i) =>
    `<figure>${lbThumbHTML(r.ads, i)}<figcaption>${escapeHtml(r.ads[i].name)}</figcaption></figure>`
  ).join('');
  openModal(`report — ${name}`,
    `${vids ? `<div class="video-row">${vids}</div>` : ''}
     ${ads ? `<h3 style="font-size:12px;margin:12px 0 6px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em;">carousels (${r.ads.length})</h3><div class="image-grid">${ads}</div>` : ''}`);
}

function showGatilhos(campaignId, name) {
  const c = state.campaigns.find((x) => x.id === campaignId);
  if (!c || !c.gatilhos?.length) return;
  const html = c.gatilhos.map((g, gIdx) => {
    const vid = g.videos[0];
    const thumbsList = g.ads.slice(0, 5);
    const key = `${campaignId}::gatilho::${gIdx}`;
    registerLb(key, thumbsList);
    const thumbs = thumbsList.map((_, i) => lbThumbHTML(thumbsList, i)).join('');
    return `
      <div class="gat-card">
        <h4>${escapeHtml(g.slug)}</h4>
        ${vid ? `<video controls preload="metadata" src="${vid.url}"></video>` : '<div class="empty-state" style="padding:20px">(sem vídeo)</div>'}
        ${thumbs ? `<div class="gat-thumbs">${thumbs}</div>` : ''}
      </div>`;
  }).join('');
  openModal(`gatilhos (${c.gatilhos.length}) — ${name}`, `<div class="gat-grid">${html}</div>`);
}

function showImages(campaignId, kind, name) {
  const c = state.campaigns.find((x) => x.id === campaignId);
  if (!c) return;
  const list = kind === 'ads' ? c.ads : c.imgs;
  const key = `${campaignId}::${kind}`;
  registerLb(key, list);
  const html = list.map((_, i) =>
    `<figure>${lbThumbHTML(list, i)}<figcaption>${escapeHtml(list[i].name)}</figcaption></figure>`
  ).join('');
  openModal(`${kind} (${list.length}) — ${name}`, `<div class="image-grid">${html}</div>`);
}

function bindEvents() {
  $$('.nav-item').forEach((b) => b.addEventListener('click', () => { if (b.dataset.view) setView(b.dataset.view); }));
  const matrizLink = $('#matrizLink');
  if (matrizLink) matrizLink.href = `${window.location.protocol}//${window.location.hostname}:5278/`;
  $('#searchInput').addEventListener('input', (e) => { state.filter.search = e.target.value; renderVideoTypes(); });
  document.body.addEventListener('change', (e) => {
    if (e.target.matches('[data-vd-size]')) vdChangeSize(e.target.value);
  });
  $('#refreshBtn').addEventListener('click', loadAll);
  document.body.addEventListener('click', (e) => {
    const t = e.target;
    if (t.matches('[data-close]')) return closeModal();
    if (t.matches('[data-lb-close]')) return closeLightbox();
    if (t.matches('[data-lb-prev]')) return lbStep(-1);
    if (t.matches('[data-lb-next]')) return lbStep(1);
    if (t.matches('img[data-lb]')) {
      const key = t.dataset.lbKey;
      const idx = Number(t.dataset.lbIdx) || 0;
      const items = lbBundles.get(key);
      if (items) { e.preventDefault(); openLightbox(items, idx); }
      return;
    }
    if (t.matches('[data-vk-back]')) return setVideoKind(null);
    if (t.matches('.nav-sub-item')) return setVideoKind(t.dataset.vk);
    const vthumb = t.closest('[data-vid-play]');
    if (vthumb && !vthumb.classList.contains('is-playing')) {
      const v = vthumb.querySelector('video');
      if (v) {
        e.stopPropagation();
        vthumb.classList.add('is-playing');
        v.controls = true; v.muted = false;
        v.play().catch(() => {});
      }
      return;
    }
    if (t.matches('[data-vd-top]')) return window.scrollTo({ top: 0, behavior: 'smooth' });
    if (t.matches('[data-vd-mode]')) return setVdMode(t.dataset.vdMode);
    if (t.matches('[data-vd-vlimit]')) return setVdVideoLimit(t.dataset.vdVlimit);
    if (t.matches('[data-vd-imgsmode]')) return setVdImgsMode(t.dataset.vdImgsmode);
    if (t.matches('[data-vd-listsize-imgs]')) return setVdImgsListSize(t.dataset.vdListsizeImgs);
    if (t.matches('[data-vd-openfile]')) {
      const path = t.dataset.vdOpenfile;
      const label = t.dataset.label || path;
      showCodeFile(path, label);
      return;
    }
    const ipageBtn = t.closest('[data-vd-ipage]');
    if (ipageBtn && !ipageBtn.disabled) return vdImgsListPage(ipageBtn.dataset.vdIpage);
    if (t.matches('[data-vd-listsize]')) {
      const v = t.dataset.vdListsize;
      const ps = getVdPage(state.activeVideoKind);
      ps.size = v === 'all' ? Number.MAX_SAFE_INTEGER : (parseInt(v, 10) || 50);
      ps.offset = 0;
      renderVideoDetail();
      return;
    }
    const pageBtn = t.closest('[data-vd-page]');
    if (pageBtn && !pageBtn.disabled) return vdChangePage(pageBtn.dataset.vdPage);
    if (t.matches('[data-vd-imglimit]')) {
      e.stopPropagation();
      const slug = t.dataset.vdImglimit;
      const n = t.dataset.n === 'all' ? Infinity : parseInt(t.dataset.n, 10);
      return setImgLimit(slug, n);
    }
    const toggle = t.closest('[data-vd-toggle]');
    if (toggle) return vdToggleRow(toggle.dataset.vdToggle);
    const action = t.dataset?.action;
    if (action === 'payload' || action === 'publish') {
      const path = decodeURIComponent(t.dataset.path);
      showFile(path, `${action} — ${t.dataset.name}`);
    } else if (action === 'videos') {
      showVideos(t.dataset.id, t.dataset.name);
    } else if (action === 'ads' || action === 'imgs') {
      showImages(t.dataset.id, action, t.dataset.name);
    } else if (action === 'gatilhos') {
      showGatilhos(t.dataset.id, t.dataset.name);
    } else if (action === 'report') {
      showReport(t.dataset.id, t.dataset.name);
    } else if (action === 'vk-open') {
      setVideoKind(t.dataset.vk);
    }
  });
  document.addEventListener('keydown', (e) => {
    const lbOpen = !$('#lightbox').hidden;
    if (e.key === 'Escape') {
      if (lbOpen) closeLightbox();
      else closeModal();
      return;
    }
    if (lbOpen) {
      if (e.key === 'ArrowLeft') lbStep(-1);
      else if (e.key === 'ArrowRight') lbStep(1);
    }
  });
}

async function loadCampaigns() {
  const data = await fetchJson('/api/campaigns');
  state.campaigns = data.campaigns;
  state.projects = data.projects;
  const sel = $('#projectFilter');
  const cur = state.filter.project;
  sel.innerHTML = '<option value="">todos os projetos</option>' + data.projects.map((p) => `<option value="${escapeHtml(p)}"${p === cur ? ' selected' : ''}>${escapeHtml(p)}</option>`).join('');
  renderCampaigns();
}

async function loadVideos() {
  try {
    const data = await fetchJson('/api/videos');
    state.videoGroups = data.groups;
    renderVideoTypes();
  } catch (err) {
    $('#videoTypes').innerHTML = `<div class="empty-state">erro: ${escapeHtml(err.message)}</div>`;
  }
}

function renderVideoSubnav() {
  const subnav = $('#videoSubnav');
  if (!subnav) return;
  if (state.view !== 'videos' || !state.videoGroups.length) {
    subnav.innerHTML = '';
    return;
  }
  subnav.innerHTML = state.videoGroups.map((g) => {
    const key = `${g.kind}`;
    const active = state.activeVideoKind === key ? ' is-active' : '';
    return `<button class="nav-sub-item${active}" data-vk="${escapeHtml(key)}">${escapeHtml(g.kind)} <span class="nav-sub-count">${g.videoCount}</span></button>`;
  }).join('');
}

function renderVideoTypes() {
  renderVideoSubnav();
  const help = $('#videoHelp');
  if (state.activeVideoKind) {
    if (help) help.hidden = true;
    $('#videoStats').innerHTML = '';
    $('#videoTypes').innerHTML = '';
    renderVideoDetail();
    return;
  }
  if (help) help.hidden = false;
  $('#videoDetail').hidden = true;
  $('#videoDetail').innerHTML = '';
  const q = (state.filter.search || '').toLowerCase().trim();
  const groups = q
    ? state.videoGroups.filter((g) =>
        g.kind.toLowerCase().includes(q) ||
        (g.slugs || []).some((s) => s.slug.toLowerCase().includes(q)) ||
        (g.videos || []).some((v) => v.name.toLowerCase().includes(q)))
    : state.videoGroups;
  const totalVids = groups.reduce((s, g) => s + g.videoCount, 0);
  const totalSlugs = groups.reduce((s, g) => s + g.slugCount, 0);
  $('#videoStats').innerHTML = `
    <div class="stat"><div class="label">Tipos</div><div class="value">${groups.length}</div></div>
    <div class="stat"><div class="label">Vídeos totais</div><div class="value">${totalVids}</div></div>
    <div class="stat"><div class="label">Slugs</div><div class="value">${totalSlugs}</div></div>
  `;
  if (!groups.length) {
    $('#videoTypes').innerHTML = '<div class="empty-state">nenhum vídeo encontrado em <code>output/videos/</code></div>';
    return;
  }
  $('#videoTypes').innerHTML = groups.map(videoTypeCard).join('');
}

function videoTypeCard(g) {
  const thumbVids = g.videos.slice(0, 4);
  const previews = thumbVids.map((v) =>
    `<video preload="metadata" muted src="${v.url}#t=0.5" title="${escapeHtml(v.name)}"></video>`
  ).join('');
  const meta = [];
  if (g.slugCount) meta.push(`<span class="tag">${g.slugCount} slugs</span>`);
  if (g.info) meta.push(`<span class="tag">${escapeHtml(g.info.title.split('—')[0].trim())}</span>`);

  return `
    <article class="vt-card">
      <header class="card-head">
        <div>
          <h3>${escapeHtml(g.kind)}</h3>
        </div>
        <small style="color:var(--text-dim)">${g.videoCount} vídeos</small>
      </header>
      ${g.info ? `<p class="vt-summary">${escapeHtml(g.info.summary)}</p>` : ''}
      <div class="vt-thumbs">${previews || '<div class="empty">—</div>'}</div>
      <div class="card-meta">${meta.join('')}</div>
      <div class="card-actions">
        <button data-action="vk-open" data-vk="${escapeHtml(g.kind)}">abrir</button>
      </div>
    </article>
  `;
}

function setVideoKind(key) {
  state.activeVideoKind = key;
  // Sempre que troca de tipo, reset os limites pro mínimo (10) — usuário pediu.
  if (key) {
    const ps = getVdPage(key);
    ps.videoLimit = 10;
    ps.imgsListSize = 10;
    ps.imgsListOffset = 0;
    ps.offset = 0;
  }
  persist();
  renderVideoTypes();
}

function workerInfoCard(label, info) {
  if (!info) return '';
  return `
    <div class="worker-block">
      <h4>${escapeHtml(label)}</h4>
      <code class="worker-script">${escapeHtml(info.script || '')}</code>
      ${info.usage ? `<div class="worker-usage"><code>${escapeHtml(info.usage)}</code></div>` : ''}
      ${info.desc ? `<p>${escapeHtml(info.desc)}</p>` : ''}
    </div>`;
}

// Estado da paginação por kind (mantém durante a sessão).
const vdPageState = {};
function getVdPage(key) {
  if (!vdPageState[key]) {
    vdPageState[key] = {
      mode: 'combined',         // 'videos' | 'imgs' | 'combined'
      videoLimit: 50,           // 10 | 50 | 100 | Infinity
      imgsMode: 50,             // 'list' | 10 | 50 | 100 | Infinity (imgs por slug)
      imgsListSize: 10,         // 10 | 50 | 100 | Infinity (slugs a mostrar no modo Imagens)
      imgsListOffset: 0,
      size: 50,                 // slugs por página (modo combined)
      offset: 0,
      openSlugs: new Set(),
      imgLimit: {},             // por slug: 10 | 50 | Infinity (modo combined)
    };
  }
  return vdPageState[key];
}
function getImgLimit(ps, slug) { return ps.imgLimit[slug] ?? 10; }
function setImgLimit(slug, n) {
  const ps = getVdPage(state.activeVideoKind);
  ps.imgLimit[slug] = n;
  renderVideoDetail();
}
function setVdMode(mode) {
  const ps = getVdPage(state.activeVideoKind);
  ps.mode = mode;
  renderVideoDetail();
  window.scrollTo({ top: $('#videoDetail').offsetTop - 12, behavior: 'smooth' });
}
function setVdVideoLimit(n) {
  const ps = getVdPage(state.activeVideoKind);
  ps.videoLimit = n === 'all' ? Infinity : parseInt(n, 10) || 50;
  renderVideoDetail();
}
function setVdImgsMode(v) {
  const ps = getVdPage(state.activeVideoKind);
  ps.imgsMode = v === 'list' ? 'list' : (v === 'all' ? Infinity : parseInt(v, 10) || 50);
  renderVideoDetail();
}
function setVdImgsListSize(v) {
  const ps = getVdPage(state.activeVideoKind);
  ps.imgsListSize = v === 'all' ? Infinity : parseInt(v, 10) || 10;
  ps.imgsListOffset = 0;
  renderVideoDetail();
}
function vdImgsListPage(dir) {
  const ps = getVdPage(state.activeVideoKind);
  const g = state.videoGroups.find((x) => x.kind === state.activeVideoKind);
  if (!g) return;
  const size = ps.imgsListSize === Infinity ? g.slugs.length : ps.imgsListSize;
  if (dir === 'next') ps.imgsListOffset = Math.min(ps.imgsListOffset + size, Math.max(0, g.slugs.length - 1));
  else if (dir === 'prev') ps.imgsListOffset = Math.max(0, ps.imgsListOffset - size);
  renderVideoDetail();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderVideoDetail() {
  const key = state.activeVideoKind;
  const g = state.videoGroups.find((x) => x.kind === key);
  const detail = $('#videoDetail');
  detail.hidden = false;
  if (!g) {
    detail.innerHTML = `<div class="empty-state">tipo "${escapeHtml(key)}" não encontrado</div>`;
    return;
  }

  const info = g.info;
  const ps = getVdPage(key);
  const total = g.slugs.length;
  const start = ps.offset;
  const end = Math.min(start + ps.size, total);
  const slice = g.slugs.slice(start, end);

  const headerHtml = `
    <div class="vd-header">
      <button class="vd-back" data-vk-back>← voltar</button>
      <div>
        <small style="color:var(--text-dim)">${escapeHtml(g.kind)}</small>
        <h2>${escapeHtml(info?.title || g.kind)}</h2>
        ${info ? `<p class="vd-summary">${escapeHtml(info.summary)}</p>` : ''}
      </div>
    </div>`;

  const workerHtml = info ? `
    <section class="vd-section">
      <div class="vd-section-head">
        <h3>Como é gerado</h3>
        <div class="vd-section-actions">
          ${info.codeFile ? `<button class="toggle-btn" data-vd-openfile="${escapeHtml(info.codeFile)}" data-label="código — ${escapeHtml(info.codeFile)}">ver código</button>` : ''}
          ${info.promptFile ? `<button class="toggle-btn" data-vd-openfile="${escapeHtml(info.promptFile)}" data-label="prompt — ${escapeHtml(info.promptFile)}">ver prompt</button>` : ''}
        </div>
      </div>
      <div class="worker-grid">
        ${workerInfoCard('1. Imagens (gen)', info.gen)}
        ${workerInfoCard('2. Vídeo (render)', info.render)}
        ${(info.extras || []).map((e) => workerInfoCard('Variante', e)).join('')}
      </div>
    </section>` : '';

  // ── Tabs de modo ────────────────────────────────────────────────────
  const sizeOpts = [10, 50, 100];
  const sizePills = ps.mode === 'combined' ? `
    <div class="vd-tabs-right">
      ${sizeOpts.map((n) => `<button class="toggle-btn${ps.size === n ? ' is-active' : ''}" data-vd-listsize="${n}">${n}</button>`).join('')}
      <button class="toggle-btn${ps.size >= total ? ' is-active' : ''}" data-vd-listsize="all">todos (${total})</button>
    </div>` : '';
  const tabsHtml = `
    <div class="vd-tabs">
      <div class="vd-tabs-left">
        <button class="vd-tab${ps.mode === 'videos' ? ' is-active' : ''}" data-vd-mode="videos">Vídeos</button>
        <button class="vd-tab${ps.mode === 'imgs' ? ' is-active' : ''}" data-vd-mode="imgs">Imagens</button>
        <button class="vd-tab${ps.mode === 'combined' ? ' is-active' : ''}" data-vd-mode="combined">Lista vídeo+imagem</button>
      </div>
      ${sizePills}
    </div>`;

  // ── Modo "videos" ───────────────────────────────────────────────────
  let modeContent = '';
  if (ps.mode === 'videos') {
    const allVids = [];
    for (const s of g.slugs) if (s.videos[0]) allVids.push({ slug: s.slug, video: s.videos[0] });
    const limit = ps.videoLimit;
    const visible = limit === Infinity ? allVids : allVids.slice(0, limit);
    const opts = [10, 50, 100];
    const toolbarVids = `
      <div class="vd-mode-toolbar">
        <small>${visible.length} de ${allVids.length} vídeos</small>
        <div class="toggles">
          ${opts.map((n) => `<button class="toggle-btn${ps.videoLimit === n ? ' is-active' : ''}" data-vd-vlimit="${n}">${n}</button>`).join('')}
          <button class="toggle-btn${ps.videoLimit === Infinity ? ' is-active' : ''}" data-vd-vlimit="all">todos (${allVids.length})</button>
        </div>
      </div>`;
    const grid = visible.length ? `<div class="v-thumb-grid">${visible.map(({ slug, video }) => {
      const profLabel = slug.replace(/_\d{4}-\d{2}-\d{2}$/, '');
      return `<div class="v-thumb" data-vid-play>
                <video preload="metadata" muted playsinline src="${video.url}#t=0.5"></video>
                <div class="v-thumb-play">▶</div>
                <small><strong>${escapeHtml(profLabel)}</strong> — ${escapeHtml(video.name)}</small>
              </div>`;
    }).join('')}</div>` : '<div class="empty-state">nenhum vídeo renderizado ainda</div>';
    modeContent = `<section class="vd-section"><h3>Vídeos</h3>${toolbarVids}${grid}</section>`;
  }

  // ── Modo "imgs" ─────────────────────────────────────────────────────
  if (ps.mode === 'imgs') {
    const opts = [10, 50, 100];
    const m = ps.imgsMode;
    const totalSlugs = g.slugs.length;
    const lsize = ps.imgsListSize === Infinity ? totalSlugs : Math.min(ps.imgsListSize, totalSlugs);
    const lstart = ps.imgsListOffset;
    const lend = Math.min(lstart + lsize, totalSlugs);
    const slicedSlugs = g.slugs.slice(lstart, lend);

    const toolbarImgs = `
      <div class="vd-mode-toolbar">
        <small>imgs por slug: <strong>${m === 'list' ? 'lista' : (m === Infinity ? 'todas' : m)}</strong></small>
        <div class="toggles">
          <button class="toggle-btn${m === 'list' ? ' is-active' : ''}" data-vd-imgsmode="list">lista</button>
          ${opts.map((n) => `<button class="toggle-btn${m === n ? ' is-active' : ''}" data-vd-imgsmode="${n}">${n}/slug</button>`).join('')}
          <button class="toggle-btn${m === Infinity ? ' is-active' : ''}" data-vd-imgsmode="all">todas</button>
        </div>
      </div>
      <div class="vd-mode-toolbar">
        <small>${totalSlugs ? `slugs ${lstart + 1}–${lend} de ${totalSlugs}` : '0 slugs'}
          ${totalSlugs > lsize ? `
            <button class="vd-btn" data-vd-ipage="prev" ${lstart === 0 ? 'disabled' : ''} style="margin-left:8px">←</button>
            <button class="vd-btn" data-vd-ipage="next" ${lend >= totalSlugs ? 'disabled' : ''}>→</button>
          ` : ''}
        </small>
        <div class="toggles">
          ${[10, 50, 100].map((n) => `<button class="toggle-btn${ps.imgsListSize === n ? ' is-active' : ''}" data-vd-listsize-imgs="${n}">${n}</button>`).join('')}
          <button class="toggle-btn${ps.imgsListSize === Infinity ? ' is-active' : ''}" data-vd-listsize-imgs="all">todos (${totalSlugs})</button>
        </div>
      </div>`;

    let body = '';
    if (m === 'list') {
      // Lista compacta: nome do slug + contagem, sem thumbs
      body = `<div class="vd-imgs-list">${slicedSlugs.map((s) => {
        const profLabel = s.slug.replace(/_\d{4}-\d{2}-\d{2}$/, '');
        return `<div class="vd-imgs-listrow">
          <span><strong>${escapeHtml(profLabel)}</strong></span>
          <span class="vd-pill">${s.imgCount} imgs</span>
        </div>`;
      }).join('')}</div>`;
    } else {
      // Grid agrupado por slug
      body = slicedSlugs.map((s) => {
        if (s.imgs.length === 0) return '';
        const lbKey = `vk::${key}::${s.slug}::imgs-mode`;
        registerLb(lbKey, s.imgs);
        const limit = m === Infinity ? s.imgs.length : Math.min(m, s.imgs.length);
        const visible = s.imgs.slice(0, limit);
        const profLabel = s.slug.replace(/_\d{4}-\d{2}-\d{2}$/, '');
        return `<div class="vd-imgs-group">
          <h4>${escapeHtml(profLabel)} <small>${visible.length}/${s.imgs.length}</small></h4>
          <div class="vd-imgs">${visible.map((_, i) => lbThumbHTML(s.imgs, i)).join('')}</div>
        </div>`;
      }).join('');
    }
    modeContent = `<section class="vd-section"><h3>Imagens</h3>${toolbarImgs}${body}</section>`;
  }

  // ── Modo "combined" (slugs com click pra abrir) ──────────────────────
  if (ps.mode !== 'combined') {
    detail.innerHTML = headerHtml + workerHtml + tabsHtml + modeContent + `<button class="vd-top" data-vd-top>↑ topo</button>`;
    return;
  }

  const toolbarHtml = total > ps.size ? `
    <div class="vd-toolbar">
      <span class="vd-page-info">${start + 1}–${end} de ${total}</span>
      <button class="vd-btn" data-vd-page="prev" ${start === 0 ? 'disabled' : ''}>← anterior</button>
      <button class="vd-btn" data-vd-page="next" ${end >= total ? 'disabled' : ''}>próxima →</button>
    </div>` : (total ? `<div class="vd-toolbar"><span class="vd-page-info">${total} slugs</span></div>` : '');

  const rowsHtml = slice.length ? slice.map((s) => {
    const lbKey = `vk::${key}::${s.slug}`;
    registerLb(lbKey, s.imgs);
    const open = ps.openSlugs.has(s.slug);
    const hasVid = s.videos.length > 0;
    const profLabel = s.slug.replace(/_\d{4}-\d{2}-\d{2}$/, '');
    const dateLabel = (s.slug.match(/_(\d{4}-\d{2}-\d{2})$/) || [])[1] || '';
    return `
      <article class="vd-row${open ? ' is-open' : ''}" data-slug="${escapeHtml(s.slug)}">
        <header class="vd-row-head" data-vd-toggle="${escapeHtml(s.slug)}">
          <span class="vd-arrow">▶</span>
          <span class="vd-row-name"><strong>${escapeHtml(profLabel)}</strong>${dateLabel ? `<small> · ${escapeHtml(dateLabel)}</small>` : ''}</span>
          <span class="vd-row-meta">
            ${hasVid ? '<span class="vd-pill vd-pill-on">video</span>' : '<span class="vd-pill vd-pill-off">sem video</span>'}
            <span class="vd-pill">${s.imgCount} imgs</span>
          </span>
        </header>
        ${open ? `
          <div class="vd-row-body vd-row-split">
            <div class="vd-row-video">
              ${hasVid ? s.videos.map((v) =>
                `<div class="v-thumb" data-vid-play>
                   <video preload="metadata" muted playsinline src="${v.url}#t=0.5"></video>
                   <div class="v-thumb-play">▶</div>
                   <small>${escapeHtml(v.name)}</small>
                 </div>`
              ).join('') : '<div class="empty-state" style="padding:8px;font-size:11px;">vídeo ainda não foi gerado</div>'}
            </div>
            <div class="vd-row-imgs">
              ${s.imgs.length ? (() => {
                const limit = getImgLimit(ps, s.slug);
                const visible = limit === Infinity ? s.imgs : s.imgs.slice(0, limit);
                const opts = [10, 50, s.imgs.length];
                return `
                  <div class="vd-img-toolbar">
                    <small>${visible.length} de ${s.imgs.length} imagens</small>
                    <div class="toggles">
                      ${opts.map((n) => {
                        const isAll = n === s.imgs.length;
                        const matches = isAll ? limit === Infinity : limit === n;
                        const label = isAll ? `todas (${n})` : String(n);
                        const value = isAll ? 'all' : String(n);
                        return `<button class="toggle-btn${matches ? ' is-active' : ''}" data-vd-imglimit="${escapeHtml(s.slug)}" data-n="${value}">${label}</button>`;
                      }).join('')}
                    </div>
                  </div>
                  <div class="vd-imgs">${visible.map((_, i) => lbThumbHTML(s.imgs, i)).join('')}</div>`;
              })() : '<small style="color:var(--text-dim)">sem imagens</small>'}
            </div>
          </div>` : ''}
      </article>`;
  }).join('') : '<div class="empty-state">nenhum slug</div>';

  const sectionHtml = `
    <section class="vd-section">
      <h3>Lista vídeo + imagem (${total})</h3>
      ${toolbarHtml}
      <div class="vd-rows">${rowsHtml}</div>
    </section>`;

  detail.innerHTML = headerHtml + workerHtml + tabsHtml + sectionHtml + `<button class="vd-top" data-vd-top>↑ topo</button>`;
}

function vdToggleRow(slug) {
  const key = state.activeVideoKind;
  if (!key) return;
  const ps = getVdPage(key);
  if (ps.openSlugs.has(slug)) ps.openSlugs.delete(slug);
  else ps.openSlugs.add(slug);
  renderVideoDetail();
}

function vdChangePage(dir) {
  const key = state.activeVideoKind;
  const g = state.videoGroups.find((x) => x.kind === key);
  if (!g) return;
  const ps = getVdPage(key);
  if (dir === 'next') ps.offset = Math.min(ps.offset + ps.size, Math.max(0, g.slugs.length - 1));
  else if (dir === 'prev') ps.offset = Math.max(0, ps.offset - ps.size);
  renderVideoDetail();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function vdChangeSize(newSize) {
  const key = state.activeVideoKind;
  const ps = getVdPage(key);
  ps.size = parseInt(newSize, 10) || 50;
  ps.offset = 0;
  renderVideoDetail();
}

async function loadConfig() {
  state.config = await fetchJson('/api/config');
  renderConfig();
}

async function loadAll() {
  $('#lastRefresh').textContent = 'carregando…';
  try {
    await loadVideos();
    if (state.view === 'config') await loadConfig();
    else if (!state.config) loadConfig().catch(() => {});
    $('#lastRefresh').textContent = 'atualizado ' + new Date().toLocaleTimeString('pt-BR');
  } catch (err) {
    $('#lastRefresh').textContent = 'erro: ' + err.message;
  }
}

bindEvents();
setView(state.view);
loadAll();
