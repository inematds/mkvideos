#!/usr/bin/env node
/**
 * Render DarkStory v2 — versão DIRECTED com motion direcionado por papel da cena.
 *
 * Cada role aplica uma "câmera" diferente:
 *   - hook:        punch-in rápido (zoom 1.00→1.18 em 1.5s, depois segura) — impacto inicial
 *   - buildup:     drift suave (pan horizontal + zoom 1.05→1.10) — curiosidade crescente
 *   - mid:         ken-burns-out (pull-back 1.15→1.00) — quebra o ritmo, pattern interrupt
 *   - darkest:     push-in pesado (zoom 1.00→1.30, com vinheta) — clímax
 *   - resolution:  drift lento direita→esquerda — assentamento
 *   - cta:         hold + fade out final — chamada
 *
 * Transições:
 *   - Crossfade 0.5s entre cenas
 *   - Fade-to-black antes do darkest (0.6s) pra reset emocional
 *   - Vignette aumenta gradativo (50% → 80% no darkest)
 *
 * Reusa as imgs + narration.mp3 do gen anterior. Não toca no scene_plan.
 *
 * Uso: node render-darkstory-directed.js <slug>_<date>
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const slug = process.argv[2];
if (!slug) { console.error('Uso: node render-darkstory-directed.js <slug>_<date>'); process.exit(1); }

const DIR = path.join(__dirname, `output/videos/darkstory/${slug}`);
const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'meta.json'), 'utf-8'));
const scenes = JSON.parse(fs.readFileSync(path.join(DIR, 'scene_plan.json'), 'utf-8'));
const timings = JSON.parse(fs.readFileSync(path.join(DIR, 'timings.json'), 'utf-8'));
const params = meta.params || {};
const FORMATO = params.formato || '9:16';
const W = FORMATO === '16:9' ? 1920 : (FORMATO === '1:1' ? 1080 : 1080);
const H = FORMATO === '16:9' ? 1080 : (FORMATO === '1:1' ? 1080 : 1920);
const FPS = 30;
const CAPTIONS = params.captions !== false;

const IMGS_DIR = path.join(DIR, 'imgs');
const NARRATION = path.join(DIR, 'audio', 'narration.mp3');
const OUT_DIR = path.join(DIR, 'video');
const OUT_FILE = path.join(OUT_DIR, `${meta.slug}-darkstory-directed-${params.duracao || 60}s.mp4`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const FONT = fs.existsSync('/home/nmaldaner/.local/share/fonts/BebasNeue-Regular.ttf')
  ? '/home/nmaldaner/.local/share/fonts/BebasNeue-Regular.ttf'
  : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

const TMP = path.join('/tmp', `darkstory-directed-${meta.slug}-${Date.now()}`);
fs.mkdirSync(TMP, { recursive: true });

// ── Build motion VF por role (DRAMATIC v2) ────────────────────────────────
function motionForRole(role, idx, dur, total) {
  const frames = Math.round(dur * FPS);
  const SCALE = `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2}`;
  const zp = (zoomExpr, xExpr, yExpr) =>
    `zoompan=z='${zoomExpr}':d=${frames}:x='${xExpr}':y='${yExpr}':s=${W}x${H}:fps=${FPS}`;

  let zp_str, grade = '', extra = '', vignAng = 'PI/5';

  if (role === 'hook') {
    // Snap-in MUITO forte: zoom 1.0 → 1.45 nos primeiros 35%, depois segura
    const peakF = Math.round(frames * 0.35);
    zp_str = zp(
      `if(lt(on,${peakF}),1+0.45*on/${peakF},1.45)`,
      'iw/2-(iw/zoom/2)',
      'ih/2-(ih/zoom/2)',
    );
    grade = 'eq=contrast=1.3:saturation=1.2:gamma=0.9';
    vignAng = 'PI/4';
  } else if (role === 'buildup') {
    // Pan horizontal AMPLO: começa cropado num lado, atravessa pro outro
    const dir = idx % 2 === 0 ? 1 : -1;
    const panAmp = 600; // bem visível
    zp_str = zp(
      '1.20',
      `iw/2-(iw/zoom/2)+(${dir}*${panAmp}*on/${frames}-${dir}*${panAmp / 2})`,
      'ih/2-(ih/zoom/2)',
    );
    grade = 'eq=contrast=1.05:saturation=0.95';
    vignAng = 'PI/5';
  } else if (role === 'mid') {
    // Pull-back forte: 1.5 → 1.0 — abre o quadro pro espectador respirar
    zp_str = zp(
      `1.5-0.5*on/${frames}`,
      'iw/2-(iw/zoom/2)',
      'ih/2-(ih/zoom/2)',
    );
    grade = 'eq=contrast=1.1:saturation=1.05';
    vignAng = 'PI/4.5';
  } else if (role === 'darkest') {
    // Push-in PESADO 1.0→1.6 + tint VERMELHO + camera shake (random offsets)
    zp_str = zp(
      `1+0.6*on/${frames}`,
      'iw/2-(iw/zoom/2)+random(' + idx + ')*8',
      'ih/2-(ih/zoom/2)+random(' + (idx + 1) + ')*8',
    );
    grade = 'colorbalance=rs=0.4:gs=-0.2:bs=-0.4,eq=saturation=0.5:contrast=1.3:gamma=0.85:brightness=-0.05';
    vignAng = 'PI/3'; // bem mais escura
  } else if (role === 'resolution') {
    // PRETO E BRANCO + drift lento — visualmente isolado do resto
    zp_str = zp(
      '1.10',
      `iw/2-(iw/zoom/2)+200-(on*400/${frames})`,
      'ih/2-(ih/zoom/2)',
    );
    grade = 'hue=s=0,eq=contrast=1.15:gamma=0.95';
    vignAng = 'PI/4.5';
  } else if (role === 'cta') {
    // Pull-back final 1.4 → 1.0 + tint sepia/quente — fechamento
    zp_str = zp(
      `1.4-0.4*on/${frames}`,
      'iw/2-(iw/zoom/2)',
      'ih/2-(ih/zoom/2)',
    );
    grade = 'colorbalance=rs=0.2:gs=0.05:bs=-0.2,eq=saturation=1.1:contrast=1.1';
    vignAng = 'PI/4';
  } else {
    zp_str = zp(`1+0.10*on/${frames}`, 'iw/2-(iw/zoom/2)', 'ih/2-(ih/zoom/2)');
  }

  const fadeIn = idx === 0 ? 0.5 : (role === 'hook' ? 0.0 : 0.3);
  const fadeOut = role === 'darkest' ? 0.6 : 0.3;

  const parts = [
    SCALE,
    zp_str,
    `vignette=angle=${vignAng}`,
    grade,
    extra,
    fadeIn > 0 ? `fade=t=in:st=0:d=${fadeIn}` : null,
    `fade=t=out:st=${(dur - fadeOut).toFixed(2)}:d=${fadeOut}`,
  ].filter(Boolean);

  return parts.join(',');
}

// ── Pre-render cada cena como mp4 ──────────────────────────────────────────
const segs = [];
console.log(`[directed] ${scenes.length} cenas, ${W}x${H}@${FPS}`);
for (let i = 0; i < timings.length; i += 1) {
  const t = timings[i];
  const img = path.join(IMGS_DIR, `cena${t.n}.jpg`);
  if (!fs.existsSync(img)) { console.warn(`! falta cena${t.n}, pulando`); continue; }
  const vf = motionForRole(t.role, i, t.duration, timings.length);
  const seg = path.join(TMP, `seg_${t.n}.mp4`);
  process.stdout.write(`── ${i + 1}/${timings.length} [${(t.role || '').padEnd(11)}] ${t.duration.toFixed(1)}s ... `);
  const args = ['-y', '-loop', '1', '-i', img, '-t', String(t.duration), '-vf', vf,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', seg];
  const r = spawnSync('ffmpeg', args, { stdio: 'pipe' });
  if (r.status !== 0) {
    console.log('✗');
    console.error(r.stderr.toString().slice(-400));
    process.exit(1);
  }
  console.log('✓');
  segs.push(seg);
}

// ── Concat com transições MARCANTES por papel ─────────────────────────────
console.log(`[directed] aplicando transições...`);
let acc = segs[0];
let accDur = timings[0].duration;
for (let i = 1; i < segs.length; i += 1) {
  const t = timings[i];
  const prevT = timings[i - 1];
  let xfDur, xfType;
  if (t.role === 'darkest') { xfType = 'fadeblack'; xfDur = 1.0; }       // 1s preto antes do clímax
  else if (t.role === 'resolution' && prevT.role === 'darkest') { xfType = 'fadeblack'; xfDur = 0.8; } // sai do darkest pro BW
  else if (t.role === 'mid') { xfType = 'fadewhite'; xfDur = 0.4; }      // flash branco no pattern interrupt
  else if (t.role === 'cta') { xfType = 'fadeblack'; xfDur = 0.6; }      // entrada do CTA
  else if (t.role === 'hook' && i === 0) { xfType = 'fade'; xfDur = 0.3; } // (não chega aqui, mas safe)
  else { xfType = 'fade'; xfDur = 0.4; }

  const offset = (accDur - xfDur).toFixed(2);
  const out = path.join(TMP, `acc_${i}.mp4`);
  const args = [
    '-y', '-i', acc, '-i', segs[i],
    '-filter_complex', `[0:v][1:v]xfade=transition=${xfType}:duration=${xfDur}:offset=${offset}[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), out,
  ];
  const r = spawnSync('ffmpeg', args, { stdio: 'pipe' });
  if (r.status !== 0) { console.error('xfade falhou cena', i, r.stderr.toString().slice(-400)); process.exit(1); }
  acc = out;
  accDur = accDur - xfDur + t.duration;
}
console.log(`[directed] vídeo total: ${accDur.toFixed(1)}s`);

// ── ASS captions ───────────────────────────────────────────────────────────
function escapeAss(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}').replace(/\n/g, ' ');
}
function tcAss(t) {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = (t % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${s}`;
}

let capsAcc = 0;
const adjustedTimings = timings.map((t, i) => {
  const xfPrev = i === 0 ? 0 : (timings[i].role === 'darkest' ? 0.6 : 0.4);
  const start = capsAcc;
  capsAcc = start + t.duration - xfPrev;
  return { ...t, adjStart: start, adjEnd: start + t.duration };
});

const fontName = path.basename(FONT, path.extname(FONT));
const fontSize = FORMATO === '9:16' ? 64 : 50;
const marginV = FORMATO === '9:16' ? 200 : 80;
const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap, ${fontName}, ${fontSize}, &H00FFFFFF, &H000000FF, &H00000000, &HCC000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 5, 3, 2, 50, 50, ${marginV}, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${adjustedTimings.filter((t) => t.caption).map((t) =>
  `Dialogue: 0,${tcAss(t.adjStart + 0.3)},${tcAss(t.adjEnd - 0.2)},Cap,,0,0,0,,${escapeAss(t.caption.toUpperCase())}`
).join('\n')}
`;
const assPath = path.join(TMP, 'captions.ass');
fs.writeFileSync(assPath, assContent);

// ── Final mux: vídeo + captions + narração ─────────────────────────────────
const finalArgs = ['-y', '-i', acc, '-i', NARRATION];
if (CAPTIONS) finalArgs.push('-vf', `subtitles='${assPath.replace(/:/g, '\\:').replace(/'/g, "\\'")}'`);
finalArgs.push(
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '160k',
  '-shortest',
  OUT_FILE,
);
console.log(`[directed] ffmpeg final → ${OUT_FILE}`);
const r = spawnSync('ffmpeg', finalArgs, { stdio: 'pipe' });
if (r.status !== 0) { console.error('FATAL final:', r.stderr.toString().slice(-500)); process.exit(1); }

const stat = fs.statSync(OUT_FILE);
console.log(`✅ ${(stat.size / 1024 / 1024).toFixed(1)}MB`);
console.log(`   ${OUT_FILE}`);
