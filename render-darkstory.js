#!/usr/bin/env node
/**
 * Render DarkStory — vídeo do canal dark a partir das imgs + scene_plan gerados pelo gen-darkstory.js.
 *
 * Pipeline:
 *   1. Lê scene_plan.json + meta.json
 *   2. Gera narração POR CENA via Chatterbox TTS daemon (voz default josh)
 *   3. Concatena narrações com pequenos silêncios entre cenas → narration.mp3
 *   4. ffmpeg compõe:
 *      - Ken Burns lento por cena (zoom +0.0015/frame, scale 2x antes pra fluidez)
 *      - Captions ASS por cena (frase curta, MAIÚSCULAS, posicionada conforme formato)
 *      - Crossfade entre cenas (0.4s)
 *      - Narração + (opcional) trilha dark de fundo
 *
 * Uso:
 *   node render-darkstory.js <slug>_<date>
 *
 * Output:
 *   output/videos/darkstory/<slug>_<date>/video/<slug>-darkstory-<dur>s.mp4
 */

const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const slug = process.argv[2];
if (!slug) {
  console.error('Uso: node render-darkstory.js <slug>_<date>');
  process.exit(1);
}

const DIR = path.join(__dirname, `output/videos/darkstory/${slug}`);
if (!fs.existsSync(path.join(DIR, 'meta.json'))) {
  console.error(`meta.json não encontrado em ${DIR}. Rode primeiro o gen.`);
  process.exit(1);
}
const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'meta.json'), 'utf-8'));
const scenes = JSON.parse(fs.readFileSync(path.join(DIR, 'scene_plan.json'), 'utf-8'));
const params = meta.params || {};
// Chatterbox daemon só tem rachel/bella; josh/etc fazem fallback pra rachel
const VOICE_RAW = params.voz || 'rachel';
const VOICE = ['rachel', 'bella'].includes(VOICE_RAW) ? VOICE_RAW : 'rachel';
if (VOICE !== VOICE_RAW) console.warn(`! voz "${VOICE_RAW}" não disponível no Chatterbox — usando "${VOICE}"`);
const FORMATO = params.formato || '9:16';
const CAPTIONS = params.captions !== false;
const DURACAO = params.duracao || 60;

const W = FORMATO === '16:9' ? 1920 : (FORMATO === '1:1' ? 1080 : 1080);
const H = FORMATO === '16:9' ? 1080 : (FORMATO === '1:1' ? 1080 : 1920);
const FPS = 30;

const IMGS_DIR = path.join(DIR, 'imgs');
const AUDIO_DIR = path.join(DIR, 'audio');
const VIDEO_DIR = path.join(DIR, 'video');
fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const NARRATION_MP3 = path.join(AUDIO_DIR, 'narration.mp3');
const OUT_FILE = path.join(VIDEO_DIR, `${meta.slug || slug.replace(/_\d{4}-\d{2}-\d{2}$/, '')}-darkstory-${DURACAO}s.mp4`);

const FONT_CAPS = '/home/nmaldaner/.local/share/fonts/BebasNeue-Regular.ttf';
const FONT_FALLBACK = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const FONT = fs.existsSync(FONT_CAPS) ? FONT_CAPS : FONT_FALLBACK;

// ── Step 1: gera narração por cena via Chatterbox daemon ───────────────────
const TTS_URL = process.env.TTS_DAEMON_URL || 'http://127.0.0.1:7860';

async function chatterboxTTS(text, outPath) {
  const body = JSON.stringify({ text, voice: VOICE, lang: 'pt', bitrate: '128k' });
  const res = await fetch(`${TTS_URL}/tts/vc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`TTS daemon HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
}

function ffprobeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf-8' });
  return parseFloat(r.stdout.trim()) || 0;
}

async function generateNarrations() {
  const sceneAudios = [];
  for (let i = 0; i < scenes.length; i += 1) {
    const s = scenes[i];
    const n = String(s.n || (i + 1)).padStart(2, '0');
    const out = path.join(AUDIO_DIR, `cena${n}.mp3`);
    if (fs.existsSync(out) && fs.statSync(out).size > 1000) {
      console.log(`── ${i + 1}/${scenes.length} narração cena${n} (cached)`);
    } else {
      process.stdout.write(`── ${i + 1}/${scenes.length} narração cena${n} ... `);
      const text = (s.narration || '').trim();
      if (!text) { console.log('skip (sem texto)'); sceneAudios.push({ scene: s, audio: null, duration: 0 }); continue; }
      try {
        await chatterboxTTS(text, out);
        console.log('✓');
      } catch (e) {
        console.log(`✗ ${e.message}`);
        sceneAudios.push({ scene: s, audio: null, duration: 0 });
        continue;
      }
    }
    const dur = ffprobeDuration(out);
    sceneAudios.push({ scene: s, audio: out, duration: dur });
  }
  return sceneAudios;
}

// ── Step 2: concatena narrações com pequenos gaps ──────────────────────────
function concatNarrations(sceneAudios) {
  const listFile = path.join(AUDIO_DIR, 'concat.txt');
  const lines = [];
  const SILENCE = path.join(AUDIO_DIR, '_silence_300.mp3');
  if (!fs.existsSync(SILENCE)) {
    spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '0.3', '-q:a', '9', SILENCE], { stdio: 'ignore' });
  }
  for (const a of sceneAudios) {
    if (a.audio) lines.push(`file '${a.audio.replace(/'/g, "'\\''")}'`);
    lines.push(`file '${SILENCE.replace(/'/g, "'\\''")}'`);
  }
  fs.writeFileSync(listFile, lines.join('\n'));
  spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', NARRATION_MP3], { stdio: 'ignore' });
  console.log(`Narração concatenada: ${NARRATION_MP3}`);
}

// ── Step 3: monta plano final de timing por cena ──────────────────────────
function planTiming(sceneAudios) {
  // Cada cena dura: max(duração da narração + 0.3s gap, 3s)
  let cursor = 0;
  return sceneAudios.map((a, i) => {
    const audDur = a.duration || 0;
    const sceneDur = Math.max(audDur + 0.3, 3.0);
    const start = cursor;
    cursor += sceneDur;
    return {
      idx: i,
      n: String(a.scene.n || i + 1).padStart(2, '0'),
      role: a.scene.role || '',
      narration: a.scene.narration,
      caption: a.scene.caption || '',
      start,
      duration: sceneDur,
      end: start + sceneDur,
    };
  });
}

// ── Step 4: gera vídeo ffmpeg ──────────────────────────────────────────────
function escapeAss(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}').replace(/\n/g, ' ');
}
function tcAss(t) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = (t % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${s}`;
}
function buildAssCaptions(timings) {
  const fontName = path.basename(FONT, path.extname(FONT));
  const fontSize = FORMATO === '9:16' ? 60 : 48;
  const marginV = FORMATO === '9:16' ? 200 : 80;
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap, ${fontName}, ${fontSize}, &H00FFFFFF, &H000000FF, &H00000000, &H00000000, 0, 0, 0, 0, 100, 100, 0, 0, 1, 4, 2, 2, 50, 50, ${marginV}, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events = timings
    .filter((t) => t.caption)
    .map((t) => `Dialogue: 0,${tcAss(t.start + 0.2)},${tcAss(t.end - 0.2)},Cap,,0,0,0,,${escapeAss(t.caption.toUpperCase())}`)
    .join('\n');
  return header + events + '\n';
}

function renderVideo(timings) {
  const totalDur = timings[timings.length - 1].end;
  console.log(`Render — ${timings.length} cenas, ${totalDur.toFixed(1)}s, ${W}x${H}@${FPS}`);

  const tmpDir = path.join('/tmp', `darkstory-${meta.slug}-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  // Pre-render cada cena como mp4 separado com ken burns
  const segs = [];
  for (const t of timings) {
    const img = path.join(IMGS_DIR, `cena${t.n}.jpg`);
    if (!fs.existsSync(img)) { console.warn(`! falta img cena${t.n}, pulando`); continue; }
    const seg = path.join(tmpDir, `seg_${t.n}.mp4`);
    const frames = Math.round(t.duration * FPS);
    // Zoom in lento (cinematic): zoom de 1.0 até ~1.10 ao longo da cena
    const zoomMax = 1.10;
    const zoomStep = (zoomMax - 1) / frames;
    // scale 2x antes do zoompan pra suavizar
    const vf = [
      `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase`,
      `crop=${W * 2}:${H * 2}`,
      `zoompan=z='min(zoom+${zoomStep.toFixed(6)},${zoomMax})':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`,
      `fade=t=in:st=0:d=0.4`,
      `fade=t=out:st=${(t.duration - 0.4).toFixed(2)}:d=0.4`,
    ].join(',');
    const args = ['-y', '-loop', '1', '-i', img, '-t', String(t.duration), '-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', seg];
    const r = spawnSync('ffmpeg', args, { stdio: 'pipe' });
    if (r.status !== 0) { console.error(`Falhou cena${t.n}:`, r.stderr.toString().slice(-200)); continue; }
    segs.push(seg);
  }

  // Concat dos segs
  const listFile = path.join(tmpDir, 'concat.txt');
  fs.writeFileSync(listFile, segs.map((s) => `file '${s}'`).join('\n'));
  const concatVideo = path.join(tmpDir, 'video_only.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', concatVideo], { stdio: 'ignore' });

  // ASS captions
  const assPath = path.join(tmpDir, 'captions.ass');
  if (CAPTIONS) {
    fs.writeFileSync(assPath, buildAssCaptions(timings));
  }

  // Mux audio + (opcional) captions
  const finalArgs = ['-y', '-i', concatVideo, '-i', NARRATION_MP3];
  let vfFinal = '';
  if (CAPTIONS && fs.existsSync(assPath)) {
    vfFinal = `subtitles='${assPath.replace(/:/g, '\\:').replace(/'/g, "\\'")}'`;
  }
  if (vfFinal) finalArgs.push('-vf', vfFinal);
  finalArgs.push(
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k',
    '-shortest',
    OUT_FILE,
  );
  console.log(`ffmpeg final: ${finalArgs.join(' ').slice(0, 200)}...`);
  const r = spawnSync('ffmpeg', finalArgs, { stdio: 'pipe' });
  if (r.status !== 0) {
    console.error('ffmpeg final falhou:', r.stderr.toString().slice(-500));
    process.exit(1);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  console.log(`[darkstory render] ${meta.titulo} (${slug})`);
  console.log(`  formato=${FORMATO} (${W}x${H}) · voz=${VOICE} · captions=${CAPTIONS} · ${scenes.length} cenas`);

  const sceneAudios = await generateNarrations();
  concatNarrations(sceneAudios);
  const timings = planTiming(sceneAudios);
  fs.writeFileSync(path.join(DIR, 'timings.json'), JSON.stringify(timings, null, 2));
  renderVideo(timings);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const stat = fs.statSync(OUT_FILE);
  console.log(`\n[darkstory:${slug}] ✅ ${(stat.size / 1024 / 1024).toFixed(1)}MB em ${elapsed}s`);
  console.log(`  → ${OUT_FILE}`);
})().catch((e) => { console.error('FATAL:', e.stack || e.message); process.exit(1); });
