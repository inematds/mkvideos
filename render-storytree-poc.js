#!/usr/bin/env node
/**
 * render-storytree-poc.js
 *
 * POC aplicando Tier 1 do relatório doc/storytree-canais-referencia.md:
 *   1. Easing curves não-lineares (ease-out exp, ease-in-out cubic, ease-in fast)
 *   2. Grain temporal + vignette permanentes (camada global)
 *   3. Shot duration variável por papel (estabelecimento 7-8s vs detalhe 1.5-2.5s)
 *   4. Letterbox progressivo nos primeiros 4s + fixo depois
 *   5. Cross-dissolves de duração variável (hard cut, 0.5s, 0.8s, 1.5s)
 *   6. Money shot — freeze + flash branco no clímax (estilo melodysheep)
 *
 * Reusa imgs do papai-noel-cinematic-v2 (38 imgs em 512x896 vertical).
 * Output: output/videos/darkstory/storytree-poc-v1_2026-05-06/video/storytree-poc.mp4
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = '/home/nmaldaner/projetos/mkvideos';
const SRC = path.join(ROOT, 'output/videos/darkstory/papai-noel-cinematic-v2_2026-05-06/imgs');
const OUT = path.join(ROOT, 'output/videos/darkstory/storytree-poc-v1_2026-05-06');
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

// ================================================================
// EASING CURVES — substituem o linear do lib/camera-moves.js
// ================================================================

// ease-out exponencial — assinatura LEMMiNO (acelera rápido, desacelera no destino)
function easeOutExp(start, end, frames) {
  const range = end - start;
  return `${start}+(${range})*(1-exp(-3*on/${frames}))`;
}

// ease-in-out cubic (smoothstep) — Bedtime, hochelaga (curva S, sem pow pra evitar escape)
function easeInOutCubic(start, end, frames) {
  const range = end - start;
  const t = `(on/${frames})`;
  return `${start}+(${range})*(3*${t}*${t}-2*${t}*${t}*${t})`;
}

// ease-in fast — zoom rápido de detalhe (Nexpo hard cut + zoom)
function easeInFast(start, end, frames) {
  const range = end - start;
  const t = `(on/${frames})`;
  return `${start}+(${range})*${t}*${t}`;
}

// linear — só pra pan constante mimético de leitura (hochelaga manuscrito)
function linear(start, end, frames) {
  const range = end - start;
  return `${start}+(${range})*on/${frames}`;
}

// ================================================================
// CAMADA GLOBAL — grain + vignette permanentes
// ================================================================

const GRAIN = `noise=alls=14:allf=t+u`;
const VIGNETTE = `vignette=PI/4`;

// Letterbox: faixas pretas crescem 0→13% nos primeiros 4s, depois fixo
function letterboxProgressive(dur) {
  const maxH = Math.round(H * 0.13);
  const ramp = Math.min(4, dur);
  const hExpr = `if(lt(t\\,${ramp})\\,t*${maxH}/${ramp}\\,${maxH})`;
  const top = `drawbox=x=0:y=0:w=iw:h='${hExpr}':color=black:t=fill`;
  const bot = `drawbox=x=0:y='ih-(${hExpr})':w=iw:h='${hExpr}':color=black:t=fill`;
  return `${top},${bot}`;
}

function letterboxFixed() {
  const h = Math.round(H * 0.13);
  const top = `drawbox=x=0:y=0:w=iw:h=${h}:color=black:t=fill`;
  const bot = `drawbox=x=0:y=ih-${h}:w=iw:h=${h}:color=black:t=fill`;
  return `${top},${bot}`;
}

// ================================================================
// SHOTS — config + zoompan customizado
// ================================================================

const SHOTS = [
  {
    name: 's1_establish',
    img: 'beat01_shot01_wide.jpg',
    role: 'estabelecimento',
    dur: 8.0,
    move: 'push-in',
    easing: 'ease-out-exp',
    z: [1.00, 1.15],
    pan: null,
    letterbox: 'progressive',
  },
  {
    name: 's2_detail',
    img: 'beat04_shot02_ots.jpg',
    role: 'detalhe',
    dur: 2.5,
    move: 'fast-zoom',
    easing: 'ease-in-fast',
    z: [1.00, 1.28],
    pan: null,
    letterbox: 'fixed',
  },
  {
    name: 's3_pan',
    img: 'beat03_shot01_medium.jpg',
    role: 'estabelecimento',
    dur: 7.0,
    move: 'pan-horizontal',
    easing: 'ease-in-out-cubic',
    z: [1.12, 1.12],
    pan: { from: -0.06, to: 0.06 },
    letterbox: 'fixed',
  },
  {
    name: 's4_climax',
    img: 'beat06_shot01_close.jpg',
    role: 'climax',
    dur: 1.5,
    move: 'freeze-flash',
    easing: 'flash',
    z: [1.05, 1.05],
    pan: null,
    letterbox: 'fixed',
    flash: true,
  },
  {
    name: 's5_reveal',
    img: 'beat07_shot03_close.jpg',
    role: 'revelacao',
    dur: 5.0,
    move: 'pull-out',
    easing: 'ease-in-out-cubic',
    z: [1.25, 1.00],
    pan: null,
    letterbox: 'fixed',
  },
  {
    name: 's6_close',
    img: 'beat10_shot01_close.jpg',
    role: 'encerramento',
    dur: 4.0,
    move: 'slow-push',
    easing: 'ease-out-exp',
    z: [1.00, 1.10],
    pan: null,
    letterbox: 'fixed',
    fadeOutBlack: 1.5,
  },
];

// Transições entre shots (entre s[i] e s[i+1])
// duration 0 ≈ hard cut; valores > 0 = cross-dissolve
const TRANSITIONS = [
  { kind: 'hard-cut', duration: 0.04 },           // s1→s2 (LEMMiNO style)
  { kind: 'cross-dissolve-short', duration: 0.8 }, // s2→s3 (Bedtime curto)
  { kind: 'hard-cut-flash', duration: 0.04 },     // s3→s4 (money shot trigger)
  { kind: 'cross-dissolve-mid', duration: 0.5 },  // s4→s5
  { kind: 'cross-dissolve-long', duration: 1.5 }, // s5→s6 (Bedtime longo)
];

// ================================================================
// Build vf (filtros encadeados) por shot
// ================================================================

function buildShotVF(shot) {
  const frames = Math.round(shot.dur * FPS);
  const cx = `iw/2-(iw/zoom/2)`;
  const cy = `ih/2-(ih/zoom/2)`;

  // 1. zoom expression (easing)
  let zExpr;
  switch (shot.easing) {
    case 'ease-out-exp':
      zExpr = easeOutExp(shot.z[0], shot.z[1], frames);
      break;
    case 'ease-in-out-cubic':
      zExpr = easeInOutCubic(shot.z[0], shot.z[1], frames);
      break;
    case 'ease-in-fast':
      zExpr = easeInFast(shot.z[0], shot.z[1], frames);
      break;
    case 'flash':
      zExpr = `${shot.z[0]}`;
      break;
    default:
      zExpr = linear(shot.z[0], shot.z[1], frames);
  }

  // 2. pan expression (deslocamento horizontal/vertical)
  let xExpr = cx;
  let yExpr = cy;
  if (shot.pan) {
    const fromPx = shot.pan.from * PRE_W;
    const toPx = shot.pan.to * PRE_W;
    const panExpr = easeInOutCubic(fromPx, toPx, frames);
    xExpr = `(${cx})+(${panExpr})`;
  }

  // 3. zoompan filter (precisa de iw/zoom calc)
  const zp = `zoompan=z='${zExpr}':d=${frames}:x='${xExpr}':y='${yExpr}':s=${W}x${H}:fps=${FPS}`;

  // 4. pre-scale 2x pra evitar pixelação no zoom
  const preScale = `scale=${PRE_W}:${PRE_H}:flags=lanczos,setsar=1:1`;

  // 5. layers globais — grain + vignette
  const globalLayers = `${GRAIN},${VIGNETTE}`;

  // 6. letterbox
  const letter = shot.letterbox === 'progressive'
    ? letterboxProgressive(shot.dur)
    : letterboxFixed();

  // 7. flash (s4 climax) — brightness ramp via eq (simula white flash)
  let flash = '';
  if (shot.flash) {
    // brilho 0.8 nos primeiros 0.15s + fade-out até 0.45s
    flash = `,eq=brightness='if(lt(t\\,0.15)\\,0.8\\,if(lt(t\\,0.45)\\,0.8*(1-(t-0.15)/0.3)\\,0))'`;
  }

  // 8. fade out preto no encerramento
  let fadeOut = '';
  if (shot.fadeOutBlack) {
    const start = (shot.dur - shot.fadeOutBlack).toFixed(2);
    fadeOut = `,fade=t=out:st=${start}:d=${shot.fadeOutBlack}`;
  }

  return `${preScale},${zp},${globalLayers},${letter}${flash}${fadeOut},format=yuv420p`;
}

// ================================================================
// Render shots
// ================================================================

function renderShot(shot, idx) {
  const inImg = path.join(SRC, shot.img);
  const out = path.join(TMP, `${String(idx).padStart(2, '0')}_${shot.name}.mp4`);
  const vf = buildShotVF(shot);

  const cmd = [
    'ffmpeg -y',
    `-loop 1 -t ${shot.dur} -i "${inImg}"`,
    `-vf "${vf}"`,
    `-r ${FPS} -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p`,
    `"${out}"`,
  ].join(' ');

  console.log(`[shot ${idx + 1}/${SHOTS.length}] ${shot.name} (${shot.dur}s, ${shot.move}, ${shot.easing}, ${shot.role})`);
  execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] });
  return { path: out, dur: shot.dur };
}

// ================================================================
// Concat com xfade encadeado (duração variável por transição)
// ================================================================

function concatWithXfade(shots) {
  const out = path.join(TMP, 'video_no_audio.mp4');

  const inputs = shots.map((s) => `-i "${s.path}"`).join(' ');

  // Cadeia de xfades: [0][1]xfade=offset=d0-t0[v01]; [v01][2]xfade=offset=d0+d1-t0-t1[v02]; ...
  // offset = cumulative duration before transition - duration of transition
  const filters = [];
  let cumulativeOut = shots[0].dur;
  let lastLabel = '0:v';

  for (let i = 0; i < TRANSITIONS.length; i++) {
    const trans = TRANSITIONS[i];
    const nextIdx = i + 1;
    const dur = trans.duration;
    const offset = (cumulativeOut - dur).toFixed(3);
    const outLabel = `v${String(i).padStart(2, '0')}`;

    // hard-cut e hard-cut-flash usam dissolve curtíssimo (0.04s)
    const transition = 'fade';
    filters.push(
      `[${lastLabel}][${nextIdx}:v]xfade=transition=${transition}:duration=${dur}:offset=${offset}[${outLabel}]`,
    );

    cumulativeOut = cumulativeOut + shots[nextIdx].dur - dur;
    lastLabel = outLabel;
  }

  const filterStr = filters.join(';');
  const cmd = [
    'ffmpeg -y',
    inputs,
    `-filter_complex "${filterStr}"`,
    `-map "[${lastLabel}]"`,
    `-t ${cumulativeOut.toFixed(3)}`,
    `-c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p`,
    `"${out}"`,
  ].join(' ');

  console.log(`[concat] xfade chain (total: ${cumulativeOut.toFixed(2)}s)`);
  execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] });
  return { path: out, dur: cumulativeOut };
}

// ================================================================
// Mix áudio: música -22dB + heartbeat no s4 (clímax)
// ================================================================

function mixAudio(videoPath, totalDur) {
  const out = path.join(VIDEO, 'storytree-poc.mp4');

  // s4 começa após s1+s2+s3 - 0.04(t1) - 0.8(t2) - 0.04(t3) = 8+2.5+7 - 0.88 = 16.62s
  // mas o flash já acontece no início de s4. heartbeat no início do s4
  const heartOffset = (8.0 + 2.5 + 7.0 - 0.04 - 0.8 - 0.04).toFixed(2);

  const cmd = [
    'ffmpeg -y',
    `-i "${videoPath}"`,
    `-stream_loop -1 -i "${MUSIC}"`,
    `-itsoffset ${heartOffset} -i "${SFX_HEART}"`,
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

  console.log(`[audio] music -22dB + heartbeat at ${heartOffset}s`);
  execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] });
  return out;
}

// ================================================================
// Main
// ================================================================

function main() {
  const t0 = Date.now();
  console.log(`storytree POC — render ${W}x${H} ${FPS}fps`);
  console.log(`source: ${SRC}`);
  console.log(`output: ${VIDEO}\n`);

  // Verifica que todas as imagens existem
  for (const s of SHOTS) {
    const p = path.join(SRC, s.img);
    if (!fs.existsSync(p)) throw new Error(`missing img: ${p}`);
  }

  // 1. Render cada shot
  const rendered = SHOTS.map((s, i) => renderShot(s, i));

  // 2. Concat com xfade
  const noAudio = concatWithXfade(rendered);

  // 3. Mix áudio
  const finalVid = mixAudio(noAudio.path, noAudio.dur);

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDONE in ${dt}s → ${finalVid}`);

  // 4. Salva metadata
  const meta = {
    timestamp: new Date().toISOString(),
    output: finalVid,
    duration: noAudio.dur,
    resolution: `${W}x${H}@${FPS}`,
    shots: SHOTS.map((s) => ({
      name: s.name,
      role: s.role,
      dur: s.dur,
      move: s.move,
      easing: s.easing,
      z: s.z,
      letterbox: s.letterbox,
    })),
    transitions: TRANSITIONS,
    techniques_applied: [
      'easing curves non-linear (ease-out-exp, ease-in-out-cubic, ease-in-fast)',
      'grain temporal global (noise alls=14 t+u)',
      'vignette permanente (PI/4)',
      'shot duration variable (1.5s climax up to 8s establishment)',
      'letterbox progressive (0->13% in first 4s)',
      'cross-dissolves variable (0.04s hard cut, 0.5s, 0.8s, 1.5s)',
      'money shot freeze + white flash (climax shot 4)',
      'pre-scale 2x lanczos (anti-pixelation)',
      'fade-out black (last 1.5s)',
    ],
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(`meta saved: ${path.join(OUT, 'meta.json')}`);
}

main();
