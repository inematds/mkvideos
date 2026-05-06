/**
 * Render CriaProf 9:16 com HOOK forte (0-3s) + CTA pesado (33-37s).
 *
 * Variante CTA do template criaprof — NÃO sobrescreve render-criaprof.js nem
 * render-criaprof-916.js. Reutiliza as 50 imgs já existentes em
 * output/videos/criaprof/<slug>_2026-04-23/imgs/.
 *
 * Usa narração NOVA (prepend hook), gerada por batch-criaprof-cta.js:
 *   /tmp/narr/narr-criaprof-cta-<variant>-<slug>.mp3
 *   /tmp/narr/whisper-criaprof-cta-<variant>-<slug>.json
 *
 * Variantes:
 *   prof    — hook usa noun da profissão (FISIOTERAPIA / MUDOU. E AGORA?)
 *   generic — hook genérico (SUA PROFISSÃO / MUDOU. E AGORA?)
 *
 * Output: output/videos/criaprof-cta-916/<slug>_<date>/video/<slug>-cta-<variant>-37s.mp4
 *
 * Uso: node render-criaprof-cta-916.js <slug> <prof|generic>
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getCtaConfig, NOUNS, getMusicForVariantAndVersion } = require('./config/profissoes-cta');

const slug = process.argv[2];
const variant = process.argv[3] || 'prof';
const version = process.argv[4] || ''; // '' = original, '1'-'5' = variantes A/B testing
if (!slug || !['prof', 'generic'].includes(variant)) {
  console.error('Usage: node render-criaprof-cta-916.js <slug> <prof|generic> [version 1-5]');
  process.exit(1);
}
const versionSuffix = version ? `-v${version}` : '';

const cta = getCtaConfig(slug, variant);

const folder = `${slug}_2026-04-23`;
// Imgs criaprof foram movidas para old/ — fallback procura nos dois lugares
const IMG_CANDIDATES = [
  path.join(__dirname, `output/videos/criaprof/${folder}/imgs`),
  path.join(__dirname, `output/videos/old/criaprof/${folder}/imgs`),
];
const IMG_DIR = IMG_CANDIDATES.find((p) => fs.existsSync(p));
if (!IMG_DIR) { console.error(`imgs não encontradas em nenhum candidato:\n  ${IMG_CANDIDATES.join('\n  ')}`); process.exit(1); }

const today = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.join(__dirname, `output/videos/criaprof-cta-916/${slug}_${today}/video`);
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_FILE = path.join(OUT_DIR, `${slug}-cta-${variant}${versionSuffix}-37s.mp4`);

// Música: por versão narrativa (v1-v5) ou por variante (v0/sem versão). Ver config/profissoes-cta.js.
const MUSIC = getMusicForVariantAndVersion(variant, version);
if (!MUSIC) console.warn(`! música não encontrada — renderizando sem música de fundo`);
const NARR = `/tmp/narr/narr-criaprof-cta-${variant}-${slug}${versionSuffix}.mp3`;
const WHISPER_JSON = `/tmp/narr/whisper-criaprof-cta-${variant}-${slug}${versionSuffix}.json`;
if (!fs.existsSync(NARR)) { console.error(`narr faltando: ${NARR}`); process.exit(1); }
if (!fs.existsSync(WHISPER_JSON)) { console.error(`whisper faltando: ${WHISPER_JSON}`); process.exit(1); }

const FONT_CAPS = '/home/nmaldaner/.local/share/fonts/BebasNeue-Regular.ttf';

// Detecta N_SCENES (cena01-fim ... cenaNN-fim)
let N_SCENES = 0;
for (let i = 1; i <= 30; i += 1) {
  const n = String(i).padStart(2, '0');
  if (fs.existsSync(path.join(IMG_DIR, `cena${n}-fim.png`))) N_SCENES = i;
}
if (N_SCENES === 0) { console.error(`nenhuma cena em ${IMG_DIR}`); process.exit(1); }

const FPS = 30, W = 1080, H = 1920, SQ = 1080, PAD_Y = 420;
const HOOK_DUR = 3;
const CTA_DUR = 4;
const N_IMGS = N_SCENES * 2; // ini + fim
const MIN_IMG_TOTAL = 25; // pisos pra imgs respirarem (≥0.5s/img)

const imgs = [];
for (let i = 1; i <= N_SCENES; i += 1) {
  const n = String(i).padStart(2, '0');
  imgs.push(path.join(IMG_DIR, `cena${n}-ini.png`));
  imgs.push(path.join(IMG_DIR, `cena${n}-fim.png`));
}
for (const p of imgs) if (!fs.existsSync(p)) { console.error(`faltando: ${p}`); process.exit(1); }

// Whisper: narração começa em t=0 do vídeo (sem offset). Filtramos caps t0 < HOOK_DUR
// (palavras do prefix-hook não viram legenda — o hook visual gigante já cobre).
const whisperData = JSON.parse(fs.readFileSync(WHISPER_JSON, 'utf8'));
const capChunks = whisperData.chunks
  .map((c) => ({
    t0: c.t0,
    t1: c.t1,
    text: c.text.replace(/inema\.?(cube|clube)/gi, 'INEMA.CLUB').replace(/ponto/gi, '.'),
  }))
  .filter((c) => c.t0 >= HOOK_DUR - 0.2);

// IMG_TOTAL dinâmico: sincroniza com duração real da narração + 0.5s buffer.
// Mínimo 25s pra todas 50 imgs respirarem (≥0.5s/img).
const lastChunk = whisperData.chunks[whisperData.chunks.length - 1];
const NARRATION_DUR = lastChunk ? lastChunk.t1 : 22;
const IMG_TOTAL = Math.max(NARRATION_DUR + 0.5, MIN_IMG_TOTAL);
const TOTAL_DUR = HOOK_DUR + IMG_TOTAL + CTA_DUR;
const DUR_PER_IMG = IMG_TOTAL / N_IMGS;
const FRAMES = Math.round(DUR_PER_IMG * FPS);
console.log(`[criaprof-cta-916 ${slug}/${variant}] narr=${NARRATION_DUR.toFixed(1)}s img_total=${IMG_TOTAL.toFixed(1)}s total=${TOTAL_DUR.toFixed(1)}s img/s=${DUR_PER_IMG.toFixed(2)}`);

const ascii = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const TMP = `/tmp/criaprof-cta-916-${slug}-${variant}-texts/`;
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
let tc = 0;
const txt = (s) => { const f = path.join(TMP, `t_${tc++}.txt`); fs.writeFileSync(f, s, 'utf8'); return f; };

function drawtext({ text, t0, t1, y, size, color = 'white', bord = 6, bordColor = 'black@0.85', font = FONT_CAPS, x = '(w-tw)/2' }) {
  const tf = txt(ascii(text));
  return `drawtext=fontfile=${font}:textfile=${tf}:fontcolor=${color}:fontsize=${size}:borderw=${bord}:bordercolor=${bordColor}:x=${x}:y=${y}:enable='between(t\\,${t0}\\,${t1})'`;
}

const presets = [
  { x: 'iw/2-(iw/zoom/2)',       y: 'ih/2-(ih/zoom/2)' },
  { x: '0',                      y: '0' },
  { x: 'iw-iw/zoom',             y: '0' },
  { x: '0',                      y: 'ih-ih/zoom' },
  { x: 'iw-iw/zoom',             y: 'ih-ih/zoom' },
  { x: 'on/FR*(iw-iw/zoom)',     y: 'ih/2-(ih/zoom/2)' },
  { x: '(iw-iw/zoom)*(1-on/FR)', y: 'ih/2-(ih/zoom/2)' },
  { x: 'iw/2-(iw/zoom/2)',       y: 'on/FR*(ih-ih/zoom)' },
];

// Inputs:
//   0:           lavfi color black 1080x1920 d=HOOK_DUR  (hook bg)
//   1..N_IMGS:   imgs cada uma loop d=DUR_PER_IMG
//   N_IMGS+1:    lavfi color black 1080x1920 d=CTA_DUR   (cta bg)
//   N_IMGS+2:    music
//   N_IMGS+3:    narr
const inputs = [];
inputs.push('-f', 'lavfi', '-t', String(HOOK_DUR), '-i', `color=black:size=${W}x${H}:rate=${FPS}`);
imgs.forEach((p) => inputs.push('-framerate', '1', '-loop', '1', '-t', String(DUR_PER_IMG), '-i', p));
inputs.push('-f', 'lavfi', '-t', String(CTA_DUR), '-i', `color=black:size=${W}x${H}:rate=${FPS}`);
if (MUSIC) inputs.push('-i', MUSIC);
inputs.push('-i', NARR);

const HOOK_IDX = 0;
const IMG_IDX_START = 1;
const CTA_IDX = 1 + N_IMGS;
const MUSIC_IDX = MUSIC ? CTA_IDX + 1 : -1;
const NARR_IDX = MUSIC ? MUSIC_IDX + 1 : CTA_IDX + 1;

// FIX tremor: pre-scale 512→2160 com Lanczos, depois zoompan opera em 2160 e produz 1080
// (downscale suave, sem shimmer da interpolação bicubic do upscale per-frame).
// zoomRate 0.0015 — bem suave, contemplativo. Lanczos pre-scale eliminou o shimmer
// que fazia zooms lentos parecerem ruins, então pode ficar lento sem tremor.
const PRE_SCALE = 2160;
const zoomRate = 0.0015;
const filters = [];

// hook bg → format yuv420p, setsar=1
filters.push(`[${HOOK_IDX}:v]format=yuv420p,setsar=1[vhook]`);

// cada img → pre-scale lanczos 2160 → zoompan → pad → vN
imgs.forEach((_, idx) => {
  const inputIdx = IMG_IDX_START + idx;
  const p = presets[idx % presets.length];
  const x = p.x.replace(/FR/g, String(FRAMES));
  const y = p.y.replace(/FR/g, String(FRAMES));
  filters.push(
    `[${inputIdx}:v]scale=${PRE_SCALE}:${PRE_SCALE}:flags=lanczos,` +
    `zoompan=z='min(1+on*${zoomRate},1.15)':d=${FRAMES}:x='${x}':y='${y}':s=${SQ}x${SQ}:fps=${FPS},` +
    `pad=${W}:${H}:0:${PAD_Y}:color=0x0A1428,format=yuv420p,setsar=1[v${idx}]`
  );
});

// cta bg → format yuv420p
filters.push(`[${CTA_IDX}:v]format=yuv420p,setsar=1[vcta]`);

// concat: hook + imgs + cta
const concatInputs = ['[vhook]', ...imgs.map((_, i) => `[v${i}]`), '[vcta]'].join('');
filters.push(`${concatInputs}concat=n=${N_IMGS + 2}:v=1:a=0[vconc]`);

// === OVERLAYS ===

// HOOK overlay (0-3s): linha 1 noun gigante amarelo, linha 2 "MUDOU. E AGORA?" branco
// Tudo centralizado vertical
const hookSize1 = cta.hookLine1.length > 14 ? 130 : 180;
const hookOverlays = [
  drawtext({ text: cta.hookLine1, t0: 0, t1: HOOK_DUR, y: 700, size: hookSize1, color: '#FFEB3B', bord: 12 }),
  drawtext({ text: cta.hookLine2, t0: 0, t1: HOOK_DUR, y: 1000, size: 110, color: 'white', bord: 10 }),
];

// Captions y=1520 (banda inferior) durante 3-33s
const captions = capChunks
  .filter((b) => b.t0 < HOOK_DUR + IMG_TOTAL + 0.5)
  .map((b) => drawtext({
    text: b.text, t0: b.t0, t1: Math.min(b.t1, HOOK_DUR + IMG_TOTAL),
    y: 1520, size: 56, color: '#FFEB3B', bord: 8, bordColor: 'black@0.95',
  }));

// Topo durante imagens: SEMPRE o nome da profissão (mesmo na variante generic).
// generic atrai amplo no hook, depois revela quem é o vídeo no topo.
const topoText = (NOUNS[slug] && NOUNS[slug].noun) || cta.hookLine1;
const topoSize = topoText.length > 14 ? 60 : 80;
const watermark = drawtext({
  text: topoText, t0: HOOK_DUR, t1: HOOK_DUR + IMG_TOTAL, y: 140, size: topoSize,
  color: 'white@0.98', bord: 7, bordColor: 'black@0.9',
});

// Rodapé centralizado na banda inferior (durante imagens)
const rodape = drawtext({
  text: 'INEMA.CLUB', t0: HOOK_DUR, t1: HOOK_DUR + IMG_TOTAL, y: '1500+(420-th)/2', size: 80,
  color: 'white', bord: 5, bordColor: 'black@0.7',
});

// CTA overlay (33-37s): INEMA.CLUB gigante
const ctaT0 = HOOK_DUR + IMG_TOTAL;
const ctaOverlays = [
  drawtext({ text: 'TRANSFORME',          t0: ctaT0, t1: TOTAL_DUR, y: 480,  size: 110, color: 'white', bord: 8 }),
  drawtext({ text: 'SUA CARREIRA',        t0: ctaT0, t1: TOTAL_DUR, y: 620,  size: 110, color: '#FFEB3B', bord: 8 }),
  drawtext({ text: 'INEMA.CLUB',          t0: ctaT0, t1: TOTAL_DUR, y: 900,  size: 200, color: '#FFEB3B', bord: 14 }),
  drawtext({ text: 'LINK NA BIO',         t0: ctaT0, t1: TOTAL_DUR, y: 1280, size: 80,  color: 'white', bord: 5 }),
];

const allOverlays = [...hookOverlays, watermark, rodape, ...captions, ...ctaOverlays].join(',');
filters.push(`[vconc]${allOverlays}[vout]`);

// === ÁUDIO ===
// narração: 0-3s volume 2.8 (impacto do hook), 3+ volume 2.0 (normal)
filters.push(
  `[${NARR_IDX}:a]volume='if(lt(t\\,${HOOK_DUR})\\,2.8\\,2.0)':eval=frame,` +
  `apad,atrim=0:${TOTAL_DUR},asetpts=PTS-STARTPTS[narr]`
);
if (MUSIC) {
  // música: 0-3s muda (voz isolada no hook), 3-ctaT0 audível durante fala (0.22), ctaT0+ alta (0.40)
  filters.push(
    `[${MUSIC_IDX}:a]aloop=loop=-1:size=2e9,atrim=0:${TOTAL_DUR},asetpts=PTS-STARTPTS,` +
    `volume='if(lt(t\\,${HOOK_DUR})\\,0\\,if(lt(t\\,${ctaT0})\\,0.22\\,0.40))':eval=frame,` +
    `afade=t=out:st=${TOTAL_DUR - 1.5}:d=1.5[music]`
  );
  filters.push(`[music][narr]amix=inputs=2:duration=first:dropout_transition=0,atrim=0:${TOTAL_DUR},asetpts=PTS-STARTPTS[aout]`);
} else {
  filters.push(`[narr]acopy[aout]`);
}

const args = [
  '-y', ...inputs,
  '-filter_complex', filters.join(';'),
  '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k',
  '-movflags', '+faststart',
  '-t', String(TOTAL_DUR),
  OUT_FILE,
];

console.log(`[criaprof-cta-916 ${slug}/${variant}] hook="${cta.hookLine1}" -> ${OUT_FILE}`);
const t0 = Date.now();
const res = spawnSync('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
if (res.status !== 0) process.exit(res.status || 1);
const stat = fs.statSync(OUT_FILE);
console.log(`[criaprof-cta-916 ${slug}/${variant}] ✅ ${(stat.size/1024/1024).toFixed(1)} MB em ${((Date.now()-t0)/1000).toFixed(1)}s`);
