#!/usr/bin/env node
/**
 * render-storytree-v2.js
 *
 * Render baseado nos 5 módulos lib/storytree-* :
 *   - presets    (vocabulário + buildShotVF + easing)
 *   - qa         (validação pré-render)
 *   - selector   (image_class × role → preset)
 *   - rhythm     (distribuição temporal por formato)
 *   - shot-schema (factory ShotPlan)
 *
 * Diferenças vs render-storytree-poc.js (v1):
 *   - shot plan formal validado por QA antes de render (rejeita errors)
 *   - presets escolhidos por matriz dupla (não hardcoded)
 *   - ritmo distribuído por formato (micro_doc 9:16 30s)
 *   - flash brightness 0.5 (era 0.8 estourado em v1)
 *   - letterbox progressive só no primeiro shot
 *   - cross-dissolve default entre shots (não hard cut)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { PRESETS, buildShotVF } = require('./lib/storytree-presets');
const { validateShotPlan, printReport } = require('./lib/storytree-qa');
const { buildPlanFromImages } = require('./lib/storytree-shot-schema');

const ROOT = '/home/nmaldaner/projetos/mkvideos';
const SRC = path.join(ROOT, 'output/videos/darkstory/papai-noel-cinematic-v2_2026-05-06/imgs');
const OUT = path.join(ROOT, 'output/videos/darkstory/storytree-v2_2026-05-06');
const VIDEO = path.join(OUT, 'video');
const TMP = path.join(OUT, 'tmp');
const MUSIC = path.join(ROOT, 'media/musicas/dark/atmospheric-pad.mp3');
const SFX_HEART = path.join(ROOT, 'media/sfx/dark/heartbeat_single.mp3');

fs.mkdirSync(VIDEO, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const W = 540;
const H = 960;
const FPS = 30;
const PRE_W = Math.round(W * 1.5);
const PRE_H = Math.round(H * 1.5);
const TOTAL_DURATION = 30; // micro_doc target

// ================================================================
// INPUT — 8 imagens classificadas (image_class manual; em produção viria de
// vision model ou do prompt original que gerou a img)
// ================================================================

const IMAGES = [
  { id: 'i01', file: 'beat01_shot01_wide.jpg',     image_class: 'dark' },        // forest atmosphere
  { id: 'i02', file: 'beat02_shot01_wide.jpg',     image_class: 'architecture' }, // church
  { id: 'i03', file: 'beat04_shot02_ots.jpg',      image_class: 'group' },       // bishop + krampus
  { id: 'i04', file: 'beat03_shot01_medium.jpg',   image_class: 'face' },        // face medium
  { id: 'i05', file: 'beat06_shot01_close.jpg',    image_class: 'face' },        // tearful child face
  { id: 'i06', file: 'beat07_shot03_close.jpg',    image_class: 'face' },        // child in sack
  { id: 'i07', file: 'beat08_shot01_wide.jpg',     image_class: 'landscape' },   // wider scene
  { id: 'i08', file: 'beat10_shot01_close.jpg',    image_class: 'object_small' },// santa+krampus
];

for (const img of IMAGES) {
  img.path = path.join(SRC, img.file);
  if (!fs.existsSync(img.path)) throw new Error(`missing: ${img.path}`);
  img.resolution = [512, 896]; // todas têm essa res
}

// ================================================================
// 1. Build shot plan via factory
// ================================================================

console.log(`storytree v2 — micro_doc 9:16 ${TOTAL_DURATION}s @ ${W}x${H}\n`);

const plan = buildPlanFromImages(IMAGES, 'micro_doc', TOTAL_DURATION);

// Override: shot do clímax força flash_cut (se houver imagem dramática disponível)
const climaxIdx = plan.findIndex((s) => s.role === 'climax');
if (climaxIdx >= 0) {
  plan[climaxIdx].motion.preset = 'flash_cut';
  Object.assign(plan[climaxIdx].motion, {
    scale_from: PRESETS.flash_cut.scale_from,
    scale_to: PRESETS.flash_cut.scale_to,
    easing: PRESETS.flash_cut.easing,
  });
}

// Último shot ganha fade-out preto
plan[plan.length - 1]._fadeOutBlack = 1.5;

// ================================================================
// AUTO-DOWNGRADE — se scale_max > 1.25 em img baixa res, clampa pra 1.20
// (evita o ERROR do QA pra fontes 512x896 quando output é 540x960)
// ================================================================
for (const s of plan) {
  if (!s.image_resolution) continue;
  const scaleMax = Math.max(s.motion.scale_from, s.motion.scale_to);
  const minRes = Math.min(s.image_resolution[0] / W, s.image_resolution[1] / H);
  if (scaleMax > 1.25 && minRes < 1.5) {
    const old = [s.motion.scale_from, s.motion.scale_to];
    if (s.motion.scale_from > 1.20) s.motion.scale_from = 1.20;
    if (s.motion.scale_to > 1.20) s.motion.scale_to = 1.20;
    console.log(`  [auto-downgrade] ${s.shot_id}: scale ${old} → [${s.motion.scale_from}, ${s.motion.scale_to}] (low-res source)`);
  }
}

// ================================================================
// 2. QA — bloqueia render se errors
// ================================================================

const qa = validateShotPlan(plan, { output_w: W, output_h: H });
console.log(printReport(qa));
if (!qa.ok) {
  console.error('\nQA FAIL — abortando render');
  fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify(qa, null, 2));
  process.exit(1);
}

// ================================================================
// 3. Salva plan + qa report
// ================================================================

fs.writeFileSync(path.join(OUT, 'shot-plan.json'), JSON.stringify(plan, null, 2));
fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify(qa, null, 2));

// Imprime sumário
console.log('\n=== SHOT PLAN ===');
for (const s of plan) {
  const fade = s._fadeOutBlack ? ` +fade${s._fadeOutBlack}s` : '';
  console.log(
    `  ${s.shot_id.padEnd(20)} ${s.role.padEnd(10)} ${s.motion.preset.padEnd(28)} ` +
    `${s.timing.duration.toFixed(1)}s ${s.motion.easing.padEnd(20)} [${s.image_class}]${fade}`,
  );
}
console.log();

// ================================================================
// 4. Render cada shot
// ================================================================

function renderShot(shot, idx) {
  const out = path.join(TMP, `${String(idx).padStart(2, '0')}_${shot.shot_id}.mp4`);
  const vf = buildShotVF(shot, {
    W, H, FPS, PRE_W, PRE_H,
    fadeOutBlack: shot._fadeOutBlack ?? 0,
  });

  const cmd = [
    'ffmpeg -y',
    `-loop 1 -t ${shot.timing.duration} -i "${shot.image_path}"`,
    `-vf "${vf}"`,
    `-r ${FPS} -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p`,
    `"${out}"`,
  ].join(' ');

  console.log(`[${idx + 1}/${plan.length}] ${shot.shot_id} (${shot.timing.duration}s, ${shot.motion.preset})`);
  execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] });
  return { path: out, dur: shot.timing.duration, transition: shot.transition };
}

const rendered = plan.map((s, i) => renderShot(s, i));

// ================================================================
// 5. Concat com xfade variável (cada shot define sua transition.in)
// ================================================================

function concatWithXfade(shots) {
  const out = path.join(TMP, 'video_no_audio.mp4');

  const inputs = shots.map((s) => `-i "${s.path}"`).join(' ');
  const filters = [];
  let cumulative = shots[0].dur;
  let last = '0:v';

  for (let i = 1; i < shots.length; i++) {
    const s = shots[i];
    const trans = s.transition;
    const dur = trans.in_duration || 0.04;
    const offset = (cumulative - dur).toFixed(3);
    const lbl = `v${String(i).padStart(2, '0')}`;
    const transition = trans.in_kind === 'hard_cut' ? 'fade' : 'fade';
    filters.push(`[${last}][${i}:v]xfade=transition=${transition}:duration=${dur}:offset=${offset}[${lbl}]`);
    cumulative = cumulative + s.dur - dur;
    last = lbl;
  }

  const filterStr = filters.join(';');
  const cmd = [
    'ffmpeg -y',
    inputs,
    `-filter_complex "${filterStr}"`,
    `-map "[${last}]"`,
    `-t ${cumulative.toFixed(3)}`,
    `-c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p`,
    `"${out}"`,
  ].join(' ');

  console.log(`[concat] ${shots.length} shots → ${cumulative.toFixed(2)}s`);
  execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] });
  return { path: out, dur: cumulative };
}

const noAudio = concatWithXfade(rendered);

// ================================================================
// 6. Mix áudio — música -22dB + heartbeat no clímax
// ================================================================

function mixAudio(videoPath, totalDur) {
  const out = path.join(VIDEO, 'storytree-v2.mp4');

  // calcula offset do clímax (cumulativo até o shot do clímax - transitions)
  let climaxOffset = 0;
  for (let i = 0; i < climaxIdx; i++) climaxOffset += plan[i].timing.duration;
  for (let i = 1; i <= climaxIdx; i++) {
    const t = plan[i].transition;
    if (t?.in_duration) climaxOffset -= t.in_duration;
  }

  const cmd = [
    'ffmpeg -y',
    `-i "${videoPath}"`,
    `-stream_loop -1 -i "${MUSIC}"`,
    `-itsoffset ${climaxOffset.toFixed(2)} -i "${SFX_HEART}"`,
    `-filter_complex "`,
    `[1:a]volume=0.40,atrim=duration=${totalDur},afade=t=in:st=0:d=2,afade=t=out:st=${(totalDur - 2).toFixed(2)}:d=2[mus];`,
    `[2:a]volume=1.2[heart];`,
    `[mus][heart]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,volume=1.4[aout]`,
    `"`,
    `-map 0:v -map "[aout]"`,
    `-t ${totalDur.toFixed(3)}`,
    `-c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k`,
    `"${out}"`,
  ].join(' ');

  console.log(`[audio] heartbeat at climax t=${climaxOffset.toFixed(2)}s`);
  execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] });
  return out;
}

const t0 = Date.now();
const finalVid = mixAudio(noAudio.path, noAudio.dur);
const dt = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`\nDONE → ${finalVid}`);

// ================================================================
// 7. Salva meta + cleanup tmp
// ================================================================

const meta = {
  timestamp: new Date().toISOString(),
  output: finalVid,
  duration: noAudio.dur,
  resolution: `${W}x${H}@${FPS}`,
  format: 'micro_doc',
  shots: plan.length,
  qa: { ok: qa.ok, errors: qa.errors.length, warnings: qa.warnings.length },
  modules: ['storytree-presets', 'storytree-qa', 'storytree-selector', 'storytree-rhythm', 'storytree-shot-schema'],
  techniques_applied: [
    'easing curves non-linear (ease-out-exp, ease-in-out-cubic, ease-out-cubic, ease-in-fast)',
    'grain temporal global (noise alls=14 t+u)',
    'vignette permanente (PI/4)',
    'shot duration variable distributed by phase (micro_doc rhythm)',
    'letterbox progressive (only first shot)',
    'cross-dissolves default 0.5s between shots',
    'money shot flash_cut (brightness 0.5 — fixed from v1)',
    'pre-scale 1.5x lanczos',
    'fade-out black (last 1.5s)',
    'motion selected by image_class × role matrix',
    'QA pre-render (validates errors, warns on patterns)',
  ],
};
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));

// cleanup tmp
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`meta saved + tmp cleaned`);
