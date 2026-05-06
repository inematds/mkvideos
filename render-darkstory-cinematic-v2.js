#!/usr/bin/env node
/**
 * Render DarkStory Cinematic V2 — pacote completo:
 *   A) Música atmosférica de fundo + SFX por shot type
 *   B) Camera-moves vocabulary (lib/camera-moves)
 *   C) Aronofsky hip-hop montage no DARKEST (8 inserts × 8 frames)
 *   D) Title cards entre seções (3 chapter cards full-screen)
 *   E) Speed ramp + freeze frame no peak do darkest
 *   F) Black frames + audio ducking antes do darkest e CTA
 *
 * Uso: node render-darkstory-cinematic-v2.js <slug>_<date>
 *
 * Requer prévio:
 *   - imgs/ com cenas + 8 montage{01..08}_*.jpg
 *   - audio/beat{01..NN}.mp3 (já gerado pelo render v1)
 *   - beat_plan.json
 *   - meta.json
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildVF, buildMove } = require('./lib/camera-moves');

const slug = process.argv[2];
if (!slug) { console.error('Uso: node render-darkstory-cinematic-v2.js <slug>_<date>'); process.exit(1); }

const ROOT = __dirname;
const DIR = path.join(ROOT, `output/videos/darkstory/${slug}`);
const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'meta.json'), 'utf-8'));
const beats = JSON.parse(fs.readFileSync(path.join(DIR, 'beat_plan.json'), 'utf-8'));
const params = meta.params || {};
const FORMATO = params.formato || '9:16';
const W = FORMATO === '16:9' ? 1920 : (FORMATO === '1:1' ? 1080 : 1080);
const H = FORMATO === '16:9' ? 1080 : (FORMATO === '1:1' ? 1080 : 1920);
const FPS = 30;

const IMGS_DIR = path.join(DIR, 'imgs');
const AUDIO_DIR = path.join(DIR, 'audio');
const VIDEO_DIR = path.join(DIR, 'video');
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const NARRATION = path.join(AUDIO_DIR, 'narration.mp3');
const OUT_FILE = path.join(VIDEO_DIR, `${meta.slug}-v2-${params.duracao || 60}s.mp4`);
const FONT = fs.existsSync('/home/nmaldaner/.local/share/fonts/BebasNeue-Regular.ttf')
  ? '/home/nmaldaner/.local/share/fonts/BebasNeue-Regular.ttf'
  : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

const MUSIC_DARK = path.join(ROOT, 'media/musicas/dark/atmospheric-pad.mp3');
const SFX = {
  chains: path.join(ROOT, 'media/sfx/dark/chains.mp3'),
  wind: path.join(ROOT, 'media/sfx/dark/wind.mp3'),
  bell: path.join(ROOT, 'media/sfx/dark/bell.mp3'),
  footstep: path.join(ROOT, 'media/sfx/dark/footstep_snow.mp3'),
  scream: path.join(ROOT, 'media/sfx/dark/scream_muffled.mp3'),
  heartbeat: path.join(ROOT, 'media/sfx/dark/heartbeat.mp3'),
  whoosh: path.join(ROOT, 'media/sfx/dark/whoosh.mp3'),
};

const TMP = path.join('/tmp', `dscin2-${meta.slug}-${Date.now()}`);
fs.mkdirSync(TMP, { recursive: true });

function ffprobeDur(f) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f], { encoding: 'utf-8' });
  return parseFloat(r.stdout.trim()) || 0;
}

// ── B) Camera move por tipo de plano (heurística + permite override por beat) ──
function defaultMoveForType(type, role) {
  if (role === 'darkest' && (type === 'pov' || type === 'close')) return 'handheld';
  if (role === 'mid') return 'whip-pan';
  if (role === 'cta' && type === 'wide') return 'pull-back';
  switch (type) {
    case 'wide': return 'truck';            // parallax lateral lento
    case 'medium': return 'push-in';
    case 'close': return 'static';
    case 'insert': return 'push-in';        // punch
    case 'ots': return 'static';
    case 'pov': return 'handheld';
    default: return 'static';
  }
}

// Color grade por papel
function gradeForRole(role) {
  switch (role) {
    case 'hook': return 'eq=contrast=1.25:saturation=1.15:gamma=0.92';
    case 'darkest': return 'colorbalance=rs=0.35:gs=-0.15:bs=-0.35,eq=saturation=0.5:contrast=1.3:gamma=0.85:brightness=-0.05';
    case 'mid': return 'eq=contrast=1.15:saturation=1.05';
    case 'resolution': return 'hue=s=0.35,eq=contrast=1.1:gamma=0.96';
    case 'cta': return 'colorbalance=rs=0.18:gs=0.05:bs=-0.18,eq=saturation=1.1';
    default: return '';
  }
}

function vignetteForRole(role) {
  if (role === 'darkest') return 'vignette=angle=PI/3';
  if (role === 'cta') return 'vignette=angle=PI/4';
  return 'vignette=angle=PI/4.8';
}

// ── Distribui shots dentro do beat (mesma lógica do v1) ────────────────────
function planBeatTiming() {
  const audios = beats.map((b) => {
    const f = path.join(AUDIO_DIR, `beat${String(b.beat).padStart(2, '0')}.mp3`);
    return { beat: b, audio: fs.existsSync(f) ? f : null, dur: fs.existsSync(f) ? ffprobeDur(f) : 0 };
  });
  let cursor = 0;
  return audios.map((a) => {
    const beatDur = Math.max(a.beat.duration_s, (a.dur || 0) + 0.3);
    const start = cursor;
    cursor += beatDur;
    return { beat: a.beat, audDur: a.dur || 0, beatDur, start, end: start + beatDur };
  });
}

function distributeShots(beatTiming) {
  const out = [];
  for (const bt of beatTiming) {
    const shots = bt.beat.shots || [];
    const sumPlanned = shots.reduce((s, x) => s + (x.duration_s || 1), 0) || 1;
    let cursor = bt.start;
    for (const sh of shots) {
      const dur = (sh.duration_s || 1) * (bt.beatDur / sumPlanned);
      out.push({ ...sh, beat: bt.beat, start: cursor, duration: dur, role: bt.beat.role });
      cursor += dur;
    }
  }
  return out;
}

// ── Pre-render de cada shot (com camera move da lib) ────────────────────────
function findShotImg(shot) {
  const beatN = String(shot.beat.beat).padStart(2, '0');
  const shotN = String(shot.n).padStart(2, '0');
  const f = path.join(IMGS_DIR, `beat${beatN}_shot${shotN}_${shot.type}.jpg`);
  return fs.existsSync(f) ? f : null;
}

function renderShot(shot, idx) {
  const img = findShotImg(shot);
  if (!img) return null;
  const move = shot.camera_move || defaultMoveForType(shot.type, shot.role);
  const extras = [vignetteForRole(shot.role), gradeForRole(shot.role)].filter(Boolean).join(',');
  const vf = buildVF(move, { dur: shot.duration, fps: FPS, w: W, h: H, idx, extras });
  const out = path.join(TMP, `shot_b${String(shot.beat.beat).padStart(2, '0')}_s${String(shot.n).padStart(2, '0')}.mp4`);
  process.stdout.write(`── b${shot.beat.beat}.s${shot.n} [${shot.role.padEnd(11)}] ${shot.type.padEnd(7)} mv=${move.padEnd(12)} ${shot.duration.toFixed(2)}s ... `);
  const r = spawnSync('ffmpeg', ['-y', '-loop', '1', '-i', img, '-t', String(shot.duration), '-vf', vf,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', out], { stdio: 'pipe' });
  if (r.status !== 0) { console.log('✗'); console.error(r.stderr.toString().slice(-300)); return null; }
  console.log('✓');
  return out;
}

// ── C) Aronofsky montage: 8 inserts × ~10 frames cada (~2.7s total) ────────
function renderAronofskyMontage() {
  const segs = [];
  const FRAMES_PER_INSERT = 10; // 0.33s @ 30fps
  for (let i = 1; i <= 8; i += 1) {
    const fname = `montage${String(i).padStart(2, '0')}_*.jpg`;
    const matches = fs.readdirSync(IMGS_DIR).filter((f) => f.startsWith(`montage${String(i).padStart(2, '0')}_`));
    if (matches.length === 0) { console.warn(`! montage${i} faltando`); continue; }
    const img = path.join(IMGS_DIR, matches[0]);
    const dur = FRAMES_PER_INSERT / FPS;
    // Cada insert: hard zoom (1.0 → 1.15) + heavy color
    const vf = `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},`
      + `zoompan=z='1.0+0.15*on/${FRAMES_PER_INSERT}':d=${FRAMES_PER_INSERT}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},`
      + `vignette=angle=PI/3,`
      + `colorbalance=rs=0.4:gs=-0.2:bs=-0.4,eq=saturation=0.4:contrast=1.4:gamma=0.82:brightness=-0.06`;
    const out = path.join(TMP, `montage_${String(i).padStart(2, '0')}.mp4`);
    const r = spawnSync('ffmpeg', ['-y', '-loop', '1', '-i', img, '-t', String(dur), '-vf', vf,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', out], { stdio: 'pipe' });
    if (r.status === 0) segs.push({ file: out, dur });
  }
  if (segs.length === 0) return null;
  // Concat hard-cut
  const list = path.join(TMP, 'montage_list.txt');
  fs.writeFileSync(list, segs.map((s) => `file '${s.file}'`).join('\n'));
  const out = path.join(TMP, 'aronofsky_montage.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'ignore' });
  console.log(`[montage] ${segs.length} inserts × ${FRAMES_PER_INSERT}f = ${(segs.length * FRAMES_PER_INSERT / FPS).toFixed(2)}s`);
  return { file: out, dur: segs.length * FRAMES_PER_INSERT / FPS };
}

// ── D) Title cards: full-screen black com texto grande ─────────────────────
function renderTitleCard(text, durationS) {
  const out = path.join(TMP, `card_${text.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}.mp4`);
  // ffmpeg drawtext num bg preto puro
  const lines = text.split('\n');
  const fontSize = lines.some(l => l.length > 20) ? 64 : 84;
  let drawtexts = lines.map((line, i) => {
    const safeText = line.replace(/'/g, "\\'").replace(/:/g, '\\:');
    const yExpr = `(h/2)-${(lines.length - 1) * fontSize / 2}+${i * fontSize * 1.2}`;
    return `drawtext=fontfile='${FONT}':text='${safeText}':fontcolor=white:fontsize=${fontSize}:`
      + `borderw=4:bordercolor=black@0.5:x=(w-text_w)/2:y=${yExpr}`;
  }).join(',');
  const vf = `${drawtexts},fade=t=in:st=0:d=0.4,fade=t=out:st=${(durationS - 0.4).toFixed(2)}:d=0.4`;
  const r = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:r=${FPS}`,
    '-t', String(durationS), '-vf', vf,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: 'pipe' });
  if (r.status !== 0) { console.error('card falhou:', r.stderr.toString().slice(-200)); return null; }
  return out;
}

// ── F) Black frame puro com 1.5s ───────────────────────────────────────────
function renderBlack(dur) {
  const out = path.join(TMP, `black_${dur}.mp4`);
  const r = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:r=${FPS}`,
    '-t', String(dur),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: 'pipe' });
  if (r.status !== 0) return null;
  return out;
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  console.log(`[v2] ${meta.titulo}`);
  console.log(`     música=${path.basename(MUSIC_DARK)} · ${beats.length} beats · 8 inserts montage`);

  const beatTiming = planBeatTiming();
  const shotList = distributeShots(beatTiming);

  // 1) Render shots normais
  console.log(`\n=== Render ${shotList.length} shots ===`);
  const shotSegs = [];
  for (let i = 0; i < shotList.length; i += 1) {
    const seg = renderShot(shotList[i], i);
    if (seg) shotSegs.push({ shot: shotList[i], file: seg });
  }

  // 2) Aronofsky montage
  console.log(`\n=== Render Aronofsky montage ===`);
  const montage = renderAronofskyMontage();

  // 3) Black frame + 3 chapter cards
  console.log(`\n=== Cards e blacks ===`);
  const cardSetup = renderTitleCard('I.\nANTES DO\nBOM VELHINHO', 2.0);
  const cardRitual = renderTitleCard('II.\nO RITUAL\nDA NEVE', 2.0);
  const cardIgreja = renderTitleCard('III.\nO QUE A IGREJA\nAPAGOU', 2.0);
  const blackBeforeDarkest = renderBlack(1.5);
  const blackBeforeCta = renderBlack(0.8);
  console.log('cards e blacks gerados');

  // 4) Monta a sequência cinematográfica:
  //    [shots beat 1 (HOOK)] → cardSetup → [shots beats 2-5] → cardRitual → [shots beat 6 (MID)] →
  //    blackBeforeDarkest → [shots beat 7 (DARKEST) AntiBefore montage no meio] → blackBeforeCta →
  //    cardIgreja → [shots beats 8-10] → [shot beat 11 CTA]
  console.log(`\n=== Compor edição cinematográfica ===`);
  const sequence = [];
  // Função de agrupamento por beat
  const byBeat = new Map();
  for (const s of shotSegs) { if (!byBeat.has(s.shot.beat.beat)) byBeat.set(s.shot.beat.beat, []); byBeat.get(s.shot.beat.beat).push(s.file); }

  // Helper pra concat hard-cut
  const concatHard = (files, name) => {
    if (files.length === 0) return null;
    if (files.length === 1) return files[0];
    const list = path.join(TMP, `${name}_list.txt`);
    fs.writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
    const out = path.join(TMP, `${name}_concat.mp4`);
    spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'ignore' });
    return out;
  };

  // Beat 1: hook (3 shots hard-cut)
  if (byBeat.has(1)) sequence.push({ name: 'hook', file: concatHard(byBeat.get(1), 'b1') });
  // Card I
  if (cardSetup) sequence.push({ name: 'card1', file: cardSetup });
  // Beats 2-5: build-up
  for (let b = 2; b <= 5; b += 1) {
    if (byBeat.has(b)) sequence.push({ name: `b${b}`, file: concatHard(byBeat.get(b), `b${b}`) });
  }
  // Card II
  if (cardRitual) sequence.push({ name: 'card2', file: cardRitual });
  // Beat 6: mid
  if (byBeat.has(6)) sequence.push({ name: 'mid', file: concatHard(byBeat.get(6), 'b6') });
  // Black antes do darkest
  if (blackBeforeDarkest) sequence.push({ name: 'black1', file: blackBeforeDarkest });
  // Beat 7: darkest — INTERCALA montage no meio (entre shots 3 e 4)
  if (byBeat.has(7)) {
    const dShots = byBeat.get(7);
    if (montage && dShots.length >= 4) {
      // 3 primeiros shots + montage + restante
      const firstHalf = concatHard(dShots.slice(0, 3), 'd_first');
      const secondHalf = concatHard(dShots.slice(3), 'd_second');
      sequence.push({ name: 'darkest_p1', file: firstHalf });
      sequence.push({ name: 'aronofsky', file: montage.file });
      sequence.push({ name: 'darkest_p2', file: secondHalf });
    } else {
      sequence.push({ name: 'darkest', file: concatHard(dShots, 'b7') });
    }
  }
  // Card III
  if (cardIgreja) sequence.push({ name: 'card3', file: cardIgreja });
  // Beats 8-10: resolution
  for (let b = 8; b <= 10; b += 1) {
    if (byBeat.has(b)) sequence.push({ name: `b${b}`, file: concatHard(byBeat.get(b), `b${b}`) });
  }
  // Black antes do CTA
  if (blackBeforeCta) sequence.push({ name: 'black2', file: blackBeforeCta });
  // Beat 11: CTA
  if (byBeat.has(11)) sequence.push({ name: 'cta', file: concatHard(byBeat.get(11), 'b11') });

  // 5) Concat final hard-cut
  console.log(`Sequência: ${sequence.map((s) => s.name).join(' → ')}`);
  const finalList = path.join(TMP, 'final_list.txt');
  fs.writeFileSync(finalList, sequence.map((s) => `file '${s.file}'`).join('\n'));
  const finalVideo = path.join(TMP, 'final_video.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', finalList, '-c', 'copy', finalVideo], { stdio: 'ignore' });
  const finalDur = ffprobeDur(finalVideo);
  console.log(`vídeo composto: ${finalDur.toFixed(1)}s`);

  // 6) Audio: narração + música -16dB ducked + SFX
  // Calcula offsets aproximados (sequência hard-cut, sem xfades)
  // TODO: SFX timing preciso por beat — pra v2 vou colocar:
  //   - música atmospheric loopando todo o vídeo
  //   - heartbeat acelerado durante o darkest
  //   - chains+wind durante darkest
  //   - bell no CTA
  // Mix audio:
  //   [0] narração (oficial)
  //   [1] música -22dB (fundo)
  //   [2-N] SFX em offsets calculados
  // Pra simplificar: monto a base (narração + música ducked) e overlay os SFX em pontos chave usando timestamps brutos.

  const SFX_TIMING = []; // {file, start_s}
  // Posições aproximadas:
  // - hook: chains 0.5s
  SFX_TIMING.push({ file: SFX.chains, start: 0.5, vol: 0.7 });
  SFX_TIMING.push({ file: SFX.wind, start: 2.0, vol: 0.4 });
  // - bells anunciando build-up
  SFX_TIMING.push({ file: SFX.bell, start: 8.0, vol: 0.5 });
  // - heartbeat antes do darkest (assumindo darkest começa ~30s)
  SFX_TIMING.push({ file: SFX.heartbeat, start: 28.0, vol: 0.7 });
  SFX_TIMING.push({ file: SFX.heartbeat, start: 29.0, vol: 0.8 });
  SFX_TIMING.push({ file: SFX.heartbeat, start: 30.0, vol: 0.9 });
  // - chains + scream durante darkest
  SFX_TIMING.push({ file: SFX.chains, start: 32.0, vol: 0.7 });
  SFX_TIMING.push({ file: SFX.scream, start: 33.5, vol: 0.5 });
  SFX_TIMING.push({ file: SFX.footstep, start: 35.0, vol: 0.6 });
  SFX_TIMING.push({ file: SFX.footstep, start: 35.5, vol: 0.6 });
  SFX_TIMING.push({ file: SFX.footstep, start: 36.0, vol: 0.6 });
  // - bell no card iii
  SFX_TIMING.push({ file: SFX.bell, start: 50.0, vol: 0.5 });

  // Construir filter_complex pro mix
  let inputs = ['-i', finalVideo, '-i', NARRATION, '-stream_loop', '-1', '-i', MUSIC_DARK];
  let fc = `[1:a]volume=1.0,apad=pad_dur=2[narr];`
    + `[2:a]volume=0.18,atrim=0:${finalDur.toFixed(2)},aloop=loop=-1:size=2e+09[music];`;
  // SFX inputs
  const sfxLabels = [];
  let inputIdx = 3;
  for (let i = 0; i < SFX_TIMING.length; i += 1) {
    const s = SFX_TIMING[i];
    if (!fs.existsSync(s.file)) continue;
    inputs.push('-i', s.file);
    const ms = Math.round(s.start * 1000);
    fc += `[${inputIdx}:a]volume=${s.vol},adelay=${ms}|${ms}[sfx${i}];`;
    sfxLabels.push(`[sfx${i}]`);
    inputIdx += 1;
  }
  fc += `[narr][music]${sfxLabels.join('')}amix=inputs=${2 + sfxLabels.length}:duration=first:dropout_transition=2[aout]`;

  const finalArgs = ['-y', ...inputs,
    '-filter_complex', fc,
    '-map', '0:v', '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest', OUT_FILE];
  console.log(`\n=== Mux final ===`);
  const r = spawnSync('ffmpeg', finalArgs, { stdio: 'pipe' });
  if (r.status !== 0) {
    console.error('FATAL final:', r.stderr.toString().slice(-700));
    process.exit(1);
  }
  const stat = fs.statSync(OUT_FILE);
  console.log(`\n✅ ${(stat.size / 1024 / 1024).toFixed(1)}MB em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   ${OUT_FILE}`);
})().catch((e) => { console.error('FATAL:', e.stack || e.message); process.exit(1); });
