/**
 * Batch A/B testing: gera TTS+whisper + renderiza vídeos CriaProf-CTA-916
 * para todos os 90 slugs × 5 versões × 2 variantes = 900 vídeos.
 *
 * Execução sequencial para não saturar GPU/TTS daemon.
 *
 * Uso:
 *   node batch-criaprof-cta-multi.js               # tudo (900 vídeos)
 *   node batch-criaprof-cta-multi.js --only-tts    # só TTS+whisper
 *   node batch-criaprof-cta-multi.js --only-render # só render (TTS já existe)
 *   node batch-criaprof-cta-multi.js --slugs fisioterapeuta,enfermeira
 *   node batch-criaprof-cta-multi.js --versions 1,3,5
 *   node batch-criaprof-cta-multi.js --variants prof
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { profissoes } = require('./config/profissoes-30');

// ─── args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const onlyTts    = args.includes('--only-tts');
const onlyRender = args.includes('--only-render');

function argVal(flag) {
  const eq = args.find(a => a.startsWith(flag + '='));
  if (eq) return eq.slice(flag.length + 1);
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const slugsArg    = argVal('--slugs');
const versionsArg = argVal('--versions');
const variantsArg = argVal('--variants');

const VERSIONS = versionsArg ? versionsArg.split(',').map(Number) : [1, 2, 3, 4, 5];
const VARIANTS = variantsArg ? variantsArg.split(',') : ['prof', 'generic'];
const slugs    = slugsArg
  ? profissoes.filter(p => slugsArg.split(',').includes(p.slug))
  : profissoes;

// ─── log ─────────────────────────────────────────────────────────────────────
const LOG = path.join(__dirname, 'logs/profissoes/_batch-criaprof-cta-multi.log');
fs.mkdirSync(path.dirname(LOG), { recursive: true });
fs.writeFileSync(LOG, `=== batch-criaprof-cta-multi ${new Date().toISOString()} ===\n`);

function log(msg) {
  console.log(msg);
  fs.appendFileSync(LOG, msg + '\n');
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function ttsReady(slug, variant, v) {
  const mp3 = `/tmp/narr/narr-criaprof-cta-${variant}-${slug}-v${v}.mp3`;
  const wsp = `/tmp/narr/whisper-criaprof-cta-${variant}-${slug}-v${v}.json`;
  return fs.existsSync(mp3) && fs.statSync(mp3).size > 10000 && fs.existsSync(wsp);
}

function allTtsReady(slug) {
  return VARIANTS.every(variant => VERSIONS.every(v => ttsReady(slug, variant, v)));
}

function videoPath(slug, variant, v) {
  const base = path.join(__dirname, 'output/videos/criaprof-cta-916');
  if (!fs.existsSync(base)) return null;
  for (const dir of fs.readdirSync(base).filter(d => d.startsWith(slug + '_'))) {
    const f = path.join(base, dir, 'video', `${slug}-cta-${variant}-v${v}-37s.mp4`);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

// ─── counters ────────────────────────────────────────────────────────────────
let ttsOk = 0, ttsSkip = 0, ttsFail = 0;
let renderOk = 0, renderSkip = 0, renderFail = 0;
const failedRender = [];
const tBatch = Date.now();

const total = slugs.length * VERSIONS.length * VARIANTS.length;
log(`Slugs: ${slugs.length}  Versões: [${VERSIONS.join(',')}]  Variantes: [${VARIANTS.join(',')}]  Total vídeos: ${total}`);

// ─── main loop ───────────────────────────────────────────────────────────────
for (const p of slugs) {
  const slug = p.slug;
  log(`\n▶▶ ${slug}`);

  // ── 1. TTS + whisper (uma chamada por slug — gen-narrations-multi gera tudo) ──
  if (!onlyRender) {
    if (allTtsReady(slug)) {
      log(`  ⏭ TTS já completo`);
      ttsSkip += VARIANTS.length * VERSIONS.length;
    } else {
      const t0 = Date.now();
      log(`  ▶ gen-narrations-multi ${slug}...`);
      const logFd = fs.openSync(LOG, 'a');
      const res = spawnSync('node', ['gen-narrations-multi.js', slug], {
        stdio: ['ignore', logFd, logFd],
        env: { ...process.env }
      });
      fs.closeSync(logFd);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (res.status !== 0) {
        log(`  ❌ TTS falhou (exit ${res.status}) em ${dt}s — pulando renders`);
        ttsFail += VARIANTS.length * VERSIONS.length;
        continue;
      }
      const generated = VARIANTS.flatMap(variant => VERSIONS.filter(v => ttsReady(slug, variant, v))).length;
      log(`  ✅ TTS ${generated}/${VARIANTS.length * VERSIONS.length} prontos em ${dt}s`);
      ttsOk += generated;
    }
  }

  // ── 2. Render ──────────────────────────────────────────────────────────────
  if (!onlyTts) {
    for (const variant of VARIANTS) {
      for (const v of VERSIONS) {
        const existing = videoPath(slug, variant, v);
        if (existing) {
          log(`  ⏭ ${variant}/v${v} já existe`);
          renderSkip++;
          continue;
        }

        if (!ttsReady(slug, variant, v)) {
          log(`  ⚠ ${variant}/v${v} sem TTS — pulando`);
          renderFail++;
          failedRender.push(`${slug}/${variant}/v${v} (sem TTS)`);
          continue;
        }

        const t0 = Date.now();
        const logFd = fs.openSync(LOG, 'a');
        const res = spawnSync('node', ['render-criaprof-cta-916.js', slug, variant, String(v)], {
          stdio: ['ignore', logFd, logFd],
          env: { ...process.env }
        });
        fs.closeSync(logFd);
        const dt = ((Date.now() - t0) / 1000).toFixed(1);

        if (res.status !== 0) {
          log(`  ❌ render ${variant}/v${v} (exit ${res.status}) em ${dt}s`);
          renderFail++;
          failedRender.push(`${slug}/${variant}/v${v}`);
        } else {
          const out = videoPath(slug, variant, v);
          const size = out ? (fs.statSync(out).size / 1024 / 1024).toFixed(1) + 'MB' : '?';
          log(`  ✅ render ${variant}/v${v} ${size} em ${dt}s`);
          renderOk++;
        }
      }
    }
  }
}

// ─── summary ─────────────────────────────────────────────────────────────────
const elapsed = ((Date.now() - tBatch) / 1000 / 60).toFixed(1);
log(`\n=========== RESUMO ===========`);
log(`Slugs: ${slugs.length}  Versões: [${VERSIONS.join(',')}]  Variantes: [${VARIANTS.join(',')}]`);
if (!onlyRender) log(`TTS: ${ttsOk} ok, ${ttsSkip} skip, ${ttsFail} falhas`);
if (!onlyTts) {
  log(`Render: ${renderOk} ok, ${renderSkip} skip, ${renderFail} falhas`);
  if (failedRender.length) log(`Falhas: ${failedRender.join(', ')}`);
}
log(`Tempo total: ${elapsed} min`);
log(`Log: ${LOG}`);
