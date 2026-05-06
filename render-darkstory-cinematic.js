#!/usr/bin/env node
/**
 * Render DarkStory Cinematic — multi-shot edit com hard-cuts dentro do beat.
 *
 * Pipeline:
 *   1. Lê beat_plan.json
 *   2. Gera narração POR BEAT via Chatterbox TTS
 *   3. Concat narrações + gaps → narration.mp3
 *   4. Cada SHOT vira um seg.mp4 com motion conforme tipo de plano
 *   5. HARD CUTS entre shots dentro do mesmo beat (cinema)
 *   6. Crossfade só ENTRE beats; fade-to-black antes do darkest; flash branco no mid
 *   7. Captions ASS por beat
 *
 * Uso: node render-darkstory-cinematic.js <slug>_<date>
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const slug = process.argv[2];
if (!slug) { console.error('Uso: node render-darkstory-cinematic.js <slug>_<date>'); process.exit(1); }

const DIR = path.join(__dirname, `output/videos/darkstory/${slug}`);
const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'meta.json'), 'utf-8'));
const beats = JSON.parse(fs.readFileSync(path.join(DIR, 'beat_plan.json'), 'utf-8'));
const params = meta.params || {};
const VOICE_RAW = params.voz || 'rachel';
const VOICE = ['rachel', 'bella'].includes(VOICE_RAW) ? VOICE_RAW : 'rachel';
const FORMATO = params.formato || '9:16';
const CAPTIONS = params.captions !== false;

const W = FORMATO === '16:9' ? 1920 : (FORMATO === '1:1' ? 1080 : 1080);
const H = FORMATO === '16:9' ? 1080 : (FORMATO === '1:1' ? 1080 : 1920);
const FPS = 30;

const IMGS_DIR = path.join(DIR, 'imgs');
const AUDIO_DIR = path.join(DIR, 'audio');
const VIDEO_DIR = path.join(DIR, 'video');
fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const NARRATION = path.join(AUDIO_DIR, 'narration.mp3');
const OUT_FILE = path.join(VIDEO_DIR, `${meta.slug}-${params.duracao || 60}s.mp4`);

const FONT = fs.existsSync('/home/nmaldaner/.local/share/fonts/BebasNeue-Regular.ttf')
  ? '/home/nmaldaner/.local/share/fonts/BebasNeue-Regular.ttf'
  : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

const TTS_URL = process.env.TTS_DAEMON_URL || 'http://127.0.0.1:7860';
const TMP = path.join('/tmp', `dscin-${meta.slug}-${Date.now()}`);
fs.mkdirSync(TMP, { recursive: true });

// ── TTS por beat ──────────────────────────────────────────────────────────
function ffprobeDur(f) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f], { encoding: 'utf-8' });
  return parseFloat(r.stdout.trim()) || 0;
}

async function ttsBeat(text, out) {
  const body = JSON.stringify({ text, voice: VOICE, lang: 'pt' });
  const res = await fetch(`${TTS_URL}/tts/vc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

async function generateNarrations() {
  const audios = [];
  for (let i = 0; i < beats.length; i += 1) {
    const b = beats[i];
    const out = path.join(AUDIO_DIR, `beat${String(b.beat).padStart(2, '0')}.mp3`);
    if (fs.existsSync(out) && fs.statSync(out).size > 1000) {
      console.log(`── ${i + 1}/${beats.length} narração beat${b.beat} (cached)`);
    } else {
      process.stdout.write(`── ${i + 1}/${beats.length} narração beat${b.beat} ... `);
      try { await ttsBeat(b.narration, out); console.log('✓'); }
      catch (e) { console.log(`✗ ${e.message}`); audios.push({ beat: b, audio: null, dur: 0 }); continue; }
    }
    audios.push({ beat: b, audio: out, dur: ffprobeDur(out) });
  }
  return audios;
}

function concatNarrations(audios) {
  const SILENCE = path.join(AUDIO_DIR, '_silence_300.mp3');
  if (!fs.existsSync(SILENCE)) {
    spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '0.3', '-q:a', '9', SILENCE], { stdio: 'ignore' });
  }
  const list = path.join(AUDIO_DIR, 'concat.txt');
  const lines = [];
  for (const a of audios) {
    if (a.audio) lines.push(`file '${a.audio}'`);
    lines.push(`file '${SILENCE}'`);
  }
  fs.writeFileSync(list, lines.join('\n'));
  spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', NARRATION], { stdio: 'ignore' });
}

// ── Beat timing: ajusta duração do beat = max(narration + 0.3, beat.duration_s) ──
function planBeatTiming(audios) {
  let cursor = 0;
  return audios.map((a) => {
    const audDur = a.dur || 0;
    // Respeita a duração planejada do beat se a narração couber; senão usa narração + 0.3
    const beatDur = Math.max(a.beat.duration_s, audDur + 0.3);
    const start = cursor;
    cursor += beatDur;
    return { beat: a.beat, audDur, beatDur, start, end: start + beatDur };
  });
}

// ── Distribui shots dentro do beat conforme suas duration_s do plan ─────────
function distributeShots(beatTiming) {
  const out = [];
  for (const bt of beatTiming) {
    const shots = bt.beat.shots || [];
    const sumPlanned = shots.reduce((s, x) => s + (x.duration_s || 1), 0) || 1;
    let cursor = bt.start;
    for (const sh of shots) {
      const dur = (sh.duration_s || 1) * (bt.beatDur / sumPlanned); // escala pra preencher o beat
      out.push({ ...sh, beat: bt.beat, start: cursor, duration: dur, role: bt.beat.role });
      cursor += dur;
    }
  }
  return out;
}

// ── Motion por tipo de plano ────────────────────────────────────────────────
function motionForShot(shot) {
  const dur = shot.duration;
  const frames = Math.round(dur * FPS);
  const SCALE = `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2}`;
  const zp = (z, x, y) => `zoompan=z='${z}':d=${frames}:x='${x}':y='${y}':s=${W}x${H}:fps=${FPS}`;

  let motion;
  switch (shot.type) {
    case 'wide':
      motion = zp(`1.0+0.05*on/${frames}`, 'iw/2-(iw/zoom/2)', 'ih/2-(ih/zoom/2)'); // drift ultra-lento
      break;
    case 'medium':
      motion = zp(`1.05+0.10*on/${frames}`, 'iw/2-(iw/zoom/2)', 'ih/2-(ih/zoom/2)'); // push leve
      break;
    case 'close':
      motion = zp('1.10', 'iw/2-(iw/zoom/2)', 'ih/2-(ih/zoom/2)'); // estático com leve crop
      break;
    case 'insert':
      motion = zp(`1.0+0.20*on/${frames}`, 'iw/2-(iw/zoom/2)', 'ih/2-(ih/zoom/2)'); // punch-in rápido
      break;
    case 'ots':
      motion = zp('1.05', 'iw/2-(iw/zoom/2)+30', 'ih/2-(ih/zoom/2)'); // leve offset, estático
      break;
    case 'pov':
      motion = zp(`1.05+0.10*on/${frames}`, `iw/2-(iw/zoom/2)+random(${shot.n})*6`, `ih/2-(ih/zoom/2)+random(${shot.n + 1})*6`); // shake
      break;
    default:
      motion = zp(`1.0+0.10*on/${frames}`, 'iw/2-(iw/zoom/2)', 'ih/2-(ih/zoom/2)');
  }

  // Color grade por papel (mantém coerência por beat)
  let grade = '';
  switch (shot.role) {
    case 'hook': grade = 'eq=contrast=1.25:saturation=1.15:gamma=0.92'; break;
    case 'darkest': grade = 'colorbalance=rs=0.35:gs=-0.15:bs=-0.35,eq=saturation=0.55:contrast=1.25:gamma=0.88:brightness=-0.04'; break;
    case 'mid': grade = 'eq=contrast=1.15:saturation=1.05'; break;
    case 'resolution': grade = 'hue=s=0.35,eq=contrast=1.10:gamma=0.96'; break; // dessat parcial (não BW puro)
    case 'cta': grade = 'colorbalance=rs=0.18:gs=0.05:bs=-0.18,eq=saturation=1.10'; break;
    default: grade = '';
  }

  // Vinheta por papel
  const vAng = shot.role === 'darkest' ? 'PI/3' : (shot.role === 'cta' ? 'PI/4' : 'PI/4.8');

  // Fade per shot — só fade out muito leve dentro do shot pra não competir com hard cut
  const parts = [SCALE, motion, `vignette=angle=${vAng}`, grade].filter(Boolean);
  return parts.join(',');
}

// ── Pre-render cada shot ───────────────────────────────────────────────────
function findShotImg(shot) {
  // Padrão de filename: beat02_shot03_close.jpg
  const beatN = String(shot.beat.beat).padStart(2, '0');
  const shotN = String(shot.n).padStart(2, '0');
  const f = path.join(IMGS_DIR, `beat${beatN}_shot${shotN}_${shot.type}.jpg`);
  return fs.existsSync(f) ? f : null;
}

function renderShots(shotList) {
  const segs = [];
  for (let i = 0; i < shotList.length; i += 1) {
    const sh = shotList[i];
    const img = findShotImg(sh);
    if (!img) { console.warn(`! falta img beat${sh.beat.beat} shot${sh.n} ${sh.type}`); continue; }
    const seg = path.join(TMP, `b${String(sh.beat.beat).padStart(2, '0')}_s${String(sh.n).padStart(2, '0')}.mp4`);
    const vf = motionForShot(sh);
    process.stdout.write(`── ${i + 1}/${shotList.length} b${sh.beat.beat}.s${sh.n} [${sh.role.padEnd(11)}] ${sh.type.padEnd(7)} ${sh.duration.toFixed(2)}s ... `);
    const args = ['-y', '-loop', '1', '-i', img, '-t', String(sh.duration), '-vf', vf,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', seg];
    const r = spawnSync('ffmpeg', args, { stdio: 'pipe' });
    if (r.status !== 0) { console.log('✗'); console.error(r.stderr.toString().slice(-300)); continue; }
    console.log('✓');
    segs.push({ shot: sh, file: seg });
  }
  return segs;
}

// ── Concat: hard-cuts entre shots do MESMO beat; xfade ENTRE beats ─────────
function concatCinematic(segs) {
  // Group by beat
  const byBeat = new Map();
  for (const s of segs) {
    const k = s.shot.beat.beat;
    if (!byBeat.has(k)) byBeat.set(k, []);
    byBeat.get(k).push(s);
  }

  // 1) Concat hard-cut interno de cada beat (concat demuxer = sem xfade)
  const beatVideos = [];
  for (const [bn, list] of byBeat.entries()) {
    if (list.length === 1) {
      beatVideos.push({ beat: list[0].shot.beat, file: list[0].file });
      continue;
    }
    const listFile = path.join(TMP, `beat${bn}_list.txt`);
    fs.writeFileSync(listFile, list.map((x) => `file '${x.file}'`).join('\n'));
    const out = path.join(TMP, `beat${bn}_full.mp4`);
    spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', out], { stdio: 'ignore' });
    beatVideos.push({ beat: list[0].shot.beat, file: out });
  }

  // 2) Xfade entre beats (transição por papel)
  let acc = beatVideos[0].file;
  let accDur = ffprobeDur(acc);
  for (let i = 1; i < beatVideos.length; i += 1) {
    const t = beatVideos[i].beat;
    const prev = beatVideos[i - 1].beat;
    let xfDur, xfType;
    if (t.role === 'darkest') { xfType = 'fadeblack'; xfDur = 1.0; }
    else if (t.role === 'mid') { xfType = 'fadewhite'; xfDur = 0.4; }
    else if (t.role === 'resolution' && prev.role === 'darkest') { xfType = 'fadeblack'; xfDur = 0.8; }
    else if (t.role === 'cta') { xfType = 'fadeblack'; xfDur = 0.6; }
    else { xfType = 'fade'; xfDur = 0.4; }
    const offset = (accDur - xfDur).toFixed(2);
    const out = path.join(TMP, `acc_${i}.mp4`);
    const args = ['-y', '-i', acc, '-i', beatVideos[i].file,
      '-filter_complex', `[0:v][1:v]xfade=transition=${xfType}:duration=${xfDur}:offset=${offset}[v]`,
      '-map', '[v]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), out];
    const r = spawnSync('ffmpeg', args, { stdio: 'pipe' });
    if (r.status !== 0) { console.error('xfade beat', i, r.stderr.toString().slice(-300)); process.exit(1); }
    acc = out;
    accDur = accDur - xfDur + ffprobeDur(beatVideos[i].file);
  }
  return { file: acc, duration: accDur };
}

// ── Captions ASS por beat ──────────────────────────────────────────────────
function buildAssCaptions(beatTiming) {
  const escAss = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}').replace(/\n/g, ' ');
  const tc = (t) => { const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const s = (t % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${s}`; };

  // Calcula offsets reais considerando os xfades aplicados no concat
  // Aproximação: cada beat começa onde o anterior terminou - xfade
  let realStart = 0;
  const events = [];
  for (let i = 0; i < beatTiming.length; i += 1) {
    const bt = beatTiming[i];
    const prev = i > 0 ? beatTiming[i - 1] : null;
    if (prev) {
      const role = bt.beat.role;
      const xfDur = role === 'darkest' ? 1.0
        : (role === 'mid' ? 0.4
        : (role === 'resolution' && prev.beat.role === 'darkest' ? 0.8
        : (role === 'cta' ? 0.6 : 0.4)));
      realStart = realStart - xfDur + bt.beatDur;
    } else {
      realStart = bt.beatDur;
    }
    const end = realStart;
    const start = end - bt.beatDur;
    if (bt.beat.caption) {
      events.push(`Dialogue: 0,${tc(start + 0.3)},${tc(end - 0.2)},Cap,,0,0,0,,${escAss(bt.beat.caption.toUpperCase())}`);
    }
  }

  const fontName = path.basename(FONT, path.extname(FONT));
  const fontSize = FORMATO === '9:16' ? 64 : 50;
  const marginV = FORMATO === '9:16' ? 200 : 80;
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap, ${fontName}, ${fontSize}, &H00FFFFFF, &H000000FF, &H00000000, &HCC000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 5, 3, 2, 50, 50, ${marginV}, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  console.log(`[${meta.slug}] ${meta.titulo} · ${beats.length} beats · ${beats.reduce((a, b) => a + (b.shots?.length || 0), 0)} shots`);

  const audios = await generateNarrations();
  concatNarrations(audios);
  const beatTiming = planBeatTiming(audios);
  const shotList = distributeShots(beatTiming);
  fs.writeFileSync(path.join(DIR, 'shot_list.json'), JSON.stringify(shotList.map((s) => ({ ...s, beat: { beat: s.beat.beat, role: s.beat.role } })), null, 2));

  const segs = renderShots(shotList);
  if (segs.length === 0) { console.error('Nenhum segmento renderizado.'); process.exit(1); }

  const concat = concatCinematic(segs);
  console.log(`[concat] vídeo total: ${concat.duration.toFixed(1)}s`);

  // Captions + áudio final
  const finalArgs = ['-y', '-i', concat.file, '-i', NARRATION];
  if (CAPTIONS) {
    const assPath = path.join(TMP, 'cap.ass');
    fs.writeFileSync(assPath, buildAssCaptions(beatTiming));
    finalArgs.push('-vf', `subtitles='${assPath.replace(/:/g, '\\:').replace(/'/g, "\\'")}'`);
  }
  finalArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-shortest', OUT_FILE);
  const r = spawnSync('ffmpeg', finalArgs, { stdio: 'pipe' });
  if (r.status !== 0) { console.error('FATAL final:', r.stderr.toString().slice(-500)); process.exit(1); }

  const stat = fs.statSync(OUT_FILE);
  console.log(`\n✅ ${(stat.size / 1024 / 1024).toFixed(1)}MB em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   ${OUT_FILE}`);
})().catch((e) => { console.error('FATAL:', e.stack || e.message); process.exit(1); });
