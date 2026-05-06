/**
 * lib/storytree-presets.js
 *
 * Vocabulário oficial de moves do storytree v1 — 16 presets com easing curves
 * explícitos. Substitui o easing linear de lib/camera-moves.js (que fica pro
 * darkstory antigo).
 *
 * Exports:
 *   PRESETS               — config de cada move (scale_from/to, easing, intensity, avoid_crop)
 *   EASING_FNS            — funções que geram expressões ffmpeg (zoompan z=)
 *   buildShotVF(shot, opts) — vf string completo (pre-scale + zoompan + grain + vignette + letterbox + flash + fade)
 *
 * Origem: doc/storytree-canais-referencia.md + relatório de mercado (Motion Grammar)
 */

// ================================================================
// EASING — funções que retornam expressões ffmpeg (variável `on` = frame atual)
// ================================================================

const EASING_FNS = {
  // ease-out exponencial — assinatura LEMMiNO (rápido, desacelera no destino)
  ease_out_exp(start, end, frames) {
    return `${start}+(${end - start})*(1-exp(-3*on/${frames}))`;
  },

  // ease-in-out cubic (smoothstep) — Bedtime, hochelaga (curva S)
  ease_in_out_cubic(start, end, frames) {
    const range = end - start;
    const t = `(on/${frames})`;
    return `${start}+(${range})*(3*${t}*${t}-2*${t}*${t}*${t})`;
  },

  // ease-out cubic — versão menos agressiva que exp
  ease_out_cubic(start, end, frames) {
    const range = end - start;
    const t = `(1-on/${frames})`;
    return `${end}-(${range})*${t}*${t}*${t}`;
  },

  // ease-in fast (quadrático) — zoom rápido de detalhe (Nexpo)
  ease_in_fast(start, end, frames) {
    const range = end - start;
    const t = `(on/${frames})`;
    return `${start}+(${range})*${t}*${t}`;
  },

  // linear — só pra pan mimético de leitura (hochelaga manuscrito)
  linear(start, end, frames) {
    return `${start}+(${end - start})*on/${frames}`;
  },
};

// ================================================================
// PRESETS — vocabulário oficial v1
// ================================================================

const PRESETS = {
  // === BASE (estabelecimento, contexto) ===
  slow_push_in: {
    description: 'zoom-in lento — suspense, rosto, detalhe importante, gancho',
    scale_from: 1.02, scale_to: 1.14,
    pan_x: [0, 0], pan_y: [0, 0],
    easing: 'ease_out_cubic',
    intensity: 'low',
    typical_dur: [6, 10],
  },
  slow_pull_out: {
    description: 'zoom-out lento — revelar contexto, encerramento documental',
    scale_from: 1.18, scale_to: 1.04,
    pan_x: [0, 0], pan_y: [0, 0],
    easing: 'ease_in_out_cubic',
    intensity: 'low',
    typical_dur: [5, 9],
  },
  pan_left: {
    description: 'deslocamento horizontal pra esquerda — paisagem, grupo',
    scale_from: 1.12, scale_to: 1.12,
    pan_x: [0.06, -0.06], pan_y: [0, 0],
    easing: 'ease_in_out_cubic',
    intensity: 'low',
    typical_dur: [5, 8],
  },
  pan_right: {
    description: 'deslocamento horizontal pra direita — leitura visual, sequência',
    scale_from: 1.12, scale_to: 1.12,
    pan_x: [-0.06, 0.06], pan_y: [0, 0],
    easing: 'ease_in_out_cubic',
    intensity: 'low',
    typical_dur: [5, 8],
  },
  pan_up: {
    description: 'baixo pra cima — fachada, monumento, grandeza',
    scale_from: 1.12, scale_to: 1.12,
    pan_x: [0, 0], pan_y: [0.05, -0.05],
    easing: 'ease_in_out_cubic',
    intensity: 'low',
    typical_dur: [5, 8],
  },
  pan_down: {
    description: 'cima pra baixo — documento, mapa, revelação de objeto',
    scale_from: 1.12, scale_to: 1.12,
    pan_x: [0, 0], pan_y: [-0.05, 0.05],
    easing: 'linear',
    intensity: 'low',
    typical_dur: [5, 8],
  },
  diagonal_drift: {
    description: 'deslocamento diagonal leve — fundo, abstrato, mood',
    scale_from: 1.10, scale_to: 1.10,
    pan_x: [-0.04, 0.04], pan_y: [0.03, -0.03],
    easing: 'ease_in_out_cubic',
    intensity: 'low',
    typical_dur: [6, 10],
  },

  // === STORYTELLING ===
  detail_to_context_reveal: {
    description: 'fechado em detalhe abrindo pra contexto — mistério, reveal',
    scale_from: 1.28, scale_to: 1.04,
    pan_x: [0.05, 0], pan_y: [-0.03, 0],
    easing: 'ease_in_out_cubic',
    intensity: 'medium',
    typical_dur: [4, 7],
  },
  context_to_detail: {
    description: 'aberto fechando em detalhe — prova visual, foco',
    scale_from: 1.04, scale_to: 1.22,
    pan_x: [0, 0], pan_y: [0, 0],
    easing: 'ease_in_out_cubic',
    intensity: 'medium',
    typical_dur: [4, 7],
  },
  face_micro_push: {
    description: 'zoom muito leve em rosto — emoção, depoimento',
    scale_from: 1.00, scale_to: 1.07,
    pan_x: [0, 0], pan_y: [0, 0],
    easing: 'ease_out_cubic',
    intensity: 'low',
    typical_dur: [4, 8],
    avoid_crop: ['eyes', 'mouth', 'chin'],
  },
  hold_micro_motion: {
    description: 'quase parado, movimento mínimo — luxo, frase forte, respiro',
    scale_from: 1.02, scale_to: 1.045,
    pan_x: [-0.005, 0.005], pan_y: [0, 0],
    easing: 'linear',
    intensity: 'low',
    typical_dur: [3, 6],
  },
  static_hold: {
    description: 'absolutamente parado — silêncio dramático antes do clímax (Bedtime, Nexpo)',
    scale_from: 1.05, scale_to: 1.05,
    pan_x: [0, 0], pan_y: [0, 0],
    easing: 'linear',
    intensity: 'low',
    typical_dur: [2, 5],
  },

  // === PUNCH ===
  pulse_zoom: {
    description: 'zoom rápido + retorno — punchline, choque, CTA',
    scale_from: 1.00, scale_to: 1.10, // pulse: 0→1.10@0.18, 1.10→1.03@0.36
    pan_x: [0, 0], pan_y: [0, 0],
    easing: 'ease_in_fast',
    intensity: 'high',
    typical_dur: [0.6, 1.5],
    pulse: true, // marker pra render lógica especial
  },
  flash_cut: {
    description: 'frame de impacto + flash branco curto — clímax, revelação',
    scale_from: 1.05, scale_to: 1.08,
    pan_x: [0, 0], pan_y: [0, 0],
    easing: 'ease_in_fast',
    intensity: 'high',
    typical_dur: [1.0, 2.0],
    flash: { brightness: 0.5, duration_in: 0.10, duration_out: 0.30 }, // FIX v1
  },
  whip_pan: {
    description: 'pan ULTRA rápido com motion blur — transição entre seções',
    scale_from: 1.20, scale_to: 1.20,
    pan_x: [-0.30, 0.30], pan_y: [0, 0],
    easing: 'ease_in_fast',
    intensity: 'high',
    typical_dur: [0.3, 0.6],
  },
  blur_to_focus: {
    description: 'desfocado entrando em foco — memória, sonho, mistério',
    scale_from: 1.05, scale_to: 1.05,
    pan_x: [0, 0], pan_y: [0, 0],
    easing: 'ease_out_cubic',
    intensity: 'medium',
    typical_dur: [1.0, 2.5],
    blur: { from: 12, to: 0, duration: 1.2 },
  },
};

// ================================================================
// CAMADA GLOBAL — grain + vignette permanentes (todos os canais usam)
// ================================================================

const GLOBAL_GRAIN = 'noise=alls=14:allf=t+u';
const GLOBAL_VIGNETTE = 'vignette=PI/4';

// ================================================================
// LETTERBOX
// ================================================================

function letterboxProgressive(dur, h_target_px) {
  const ramp = Math.min(4, dur);
  const hExpr = `if(lt(t\\,${ramp})\\,t*${h_target_px}/${ramp}\\,${h_target_px})`;
  const top = `drawbox=x=0:y=0:w=iw:h='${hExpr}':color=black:t=fill`;
  const bot = `drawbox=x=0:y='ih-(${hExpr})':w=iw:h='${hExpr}':color=black:t=fill`;
  return `${top},${bot}`;
}

function letterboxFixed(h_target_px) {
  const top = `drawbox=x=0:y=0:w=iw:h=${h_target_px}:color=black:t=fill`;
  const bot = `drawbox=x=0:y=ih-${h_target_px}:w=iw:h=${h_target_px}:color=black:t=fill`;
  return `${top},${bot}`;
}

// ================================================================
// buildShotVF — compõe o vf string completo
// opts = { W, H, FPS, PRE_W, PRE_H, dur, letterbox: 'progressive'|'fixed'|null,
//          letterbox_h, fadeOutBlack: 0|seconds, customBlur: bool }
// ================================================================

function buildShotVF(shot, opts) {
  const {
    W, H, FPS, PRE_W, PRE_H,
    letterbox_h = Math.round(H * 0.13),
    fadeOutBlack = 0,
  } = opts;

  const preset = PRESETS[shot.motion.preset];
  if (!preset) throw new Error(`unknown preset: ${shot.motion.preset}`);

  const dur = shot.timing.duration;
  const frames = Math.round(dur * FPS);
  const cx = `iw/2-(iw/zoom/2)`;
  const cy = `ih/2-(ih/zoom/2)`;

  // 1. zoom expression (com easing curve)
  const easingFn = EASING_FNS[preset.easing] || EASING_FNS.linear;
  const scaleFrom = shot.motion.scale_from ?? preset.scale_from;
  const scaleTo = shot.motion.scale_to ?? preset.scale_to;
  let zExpr;
  if (preset.pulse) {
    // pulse_zoom: 0→to em 1/3 dur, to→1.03 em 1/3, hold em 1/3
    const f1 = Math.round(frames / 3);
    const f2 = Math.round(2 * frames / 3);
    zExpr = `if(lt(on\\,${f1})\\,${scaleFrom}+(${scaleTo - scaleFrom})*on/${f1}\\,if(lt(on\\,${f2})\\,${scaleTo}-(${scaleTo - 1.03})*(on-${f1})/${f1}\\,1.03))`;
  } else {
    zExpr = easingFn(scaleFrom, scaleTo, frames);
  }

  // 2. pan expression
  const panX = shot.motion.pan_x ?? preset.pan_x ?? [0, 0];
  const panY = shot.motion.pan_y ?? preset.pan_y ?? [0, 0];
  let xExpr = cx;
  let yExpr = cy;
  if (panX[0] !== 0 || panX[1] !== 0) {
    const fromPx = panX[0] * PRE_W;
    const toPx = panX[1] * PRE_W;
    const panExpr = easingFn(fromPx, toPx, frames);
    xExpr = `(${cx})+(${panExpr})`;
  }
  if (panY[0] !== 0 || panY[1] !== 0) {
    const fromPx = panY[0] * PRE_H;
    const toPx = panY[1] * PRE_H;
    const panExpr = easingFn(fromPx, toPx, frames);
    yExpr = `(${cy})+(${panExpr})`;
  }

  // 3. zoompan filter
  const zp = `zoompan=z='${zExpr}':d=${frames}:x='${xExpr}':y='${yExpr}':s=${W}x${H}:fps=${FPS}`;

  // 4. pre-scale lanczos
  const preScale = `scale=${PRE_W}:${PRE_H}:flags=lanczos,setsar=1:1`;

  // 5. blur (blur_to_focus preset) — gblur não aceita expressão temporal em sigma
  // workaround: split shot em 2 segmentos (com blur fixo + sem blur).
  // Em v1 o blur dinâmico fica desabilitado; usa só o motion path.
  // TODO v2: pre-render 2 partes via concat ou usar lensblur/boxblur com loop_filter.
  let blur = '';

  // 6. globais
  const globals = `${GLOBAL_GRAIN},${GLOBAL_VIGNETTE}`;

  // 7. letterbox
  let letter = '';
  if (shot.letterbox === 'progressive') letter = `,${letterboxProgressive(dur, letterbox_h)}`;
  else if (shot.letterbox === 'fixed') letter = `,${letterboxFixed(letterbox_h)}`;

  // 8. flash (flash_cut preset)
  let flash = '';
  if (preset.flash) {
    const { brightness, duration_in, duration_out } = preset.flash;
    const fadeStart = duration_in.toFixed(2);
    const fadeEnd = (duration_in + duration_out).toFixed(2);
    flash = `,eq=brightness='if(lt(t\\,${fadeStart})\\,${brightness}\\,if(lt(t\\,${fadeEnd})\\,${brightness}*(1-(t-${fadeStart})/${duration_out})\\,0))'`;
  }

  // 9. fade out preto
  let fadeOut = '';
  if (fadeOutBlack > 0) {
    const start = (dur - fadeOutBlack).toFixed(2);
    fadeOut = `,fade=t=out:st=${start}:d=${fadeOutBlack}`;
  }

  return `${preScale},${zp}${blur},${globals}${letter}${flash}${fadeOut},format=yuv420p`;
}

module.exports = { PRESETS, EASING_FNS, buildShotVF, letterboxProgressive, letterboxFixed, GLOBAL_GRAIN, GLOBAL_VIGNETTE };
