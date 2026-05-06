/**
 * lib/storytree-selector.js
 *
 * Matriz dupla image_class × role → escolhe o preset apropriado.
 * Source: doc/storytree-canais-referencia.md (matriz movimento×imagem) +
 *         relatório de mercado (matriz movimento×função narrativa).
 */

const { PRESETS } = require('./storytree-presets');

// Movimento por TIPO DE IMAGEM
const IMAGE_TYPE_MOVES = {
  face: ['face_micro_push', 'hold_micro_motion'],
  landscape: ['pan_left', 'pan_right', 'diagonal_drift', 'slow_pull_out'],
  product: ['slow_push_in', 'context_to_detail', 'static_hold'],
  document: ['pan_down', 'hold_micro_motion', 'static_hold'],
  object_small: ['context_to_detail', 'slow_push_in'],
  abstract: ['diagonal_drift', 'slow_push_in', 'hold_micro_motion'],
  dark: ['slow_push_in', 'blur_to_focus', 'static_hold'],
  group: ['slow_pull_out', 'pan_left', 'pan_right'],
  architecture: ['pan_left', 'pan_right', 'pan_up', 'slow_push_in'],
  map: ['pan_down', 'context_to_detail'],
  unknown: ['slow_push_in', 'slow_pull_out', 'pan_left', 'diagonal_drift'],
};

// Movimento por FUNÇÃO NARRATIVA (role)
const ROLE_MOVES = {
  hook: ['slow_push_in', 'pulse_zoom', 'flash_cut', 'detail_to_context_reveal'],
  context: ['slow_pull_out', 'pan_left', 'pan_right', 'diagonal_drift'],
  explanation: ['context_to_detail', 'pan_down', 'static_hold'],
  suspense: ['slow_push_in', 'blur_to_focus', 'static_hold'],
  discovery: ['detail_to_context_reveal', 'context_to_detail'],
  climax: ['flash_cut', 'pulse_zoom', 'whip_pan'],
  rest: ['hold_micro_motion', 'static_hold', 'diagonal_drift'],
  closing: ['slow_pull_out', 'hold_micro_motion'],
};

// Restrições — preset proibido pra image_class (ex: zoom forte em rosto)
const FORBIDDEN = {
  face: ['flash_cut', 'whip_pan', 'pulse_zoom'],
  document: ['blur_to_focus', 'whip_pan'],
  group: ['context_to_detail'], // crop em rosto
};

/**
 * Seleciona o preset ideal pra um shot.
 *
 * Estratégia: intersecta IMAGE_TYPE_MOVES[image_class] ∩ ROLE_MOVES[role],
 * remove os forbidden, retorna o primeiro. Se intersecção vazia, prefere ROLE
 * sobre IMAGE (ritmo narrativo importa mais que fit visual).
 *
 * Aceita seed pra reprodutibilidade ou variação (ex: alternar entre opções).
 */
function selectMove(imageClass = 'unknown', role = 'context', seed = 0) {
  const imgPool = IMAGE_TYPE_MOVES[imageClass] || IMAGE_TYPE_MOVES.unknown;
  const rolePool = ROLE_MOVES[role] || ROLE_MOVES.context;
  const forbidden = FORBIDDEN[imageClass] || [];

  // 1. tenta intersecção
  let intersect = imgPool.filter((m) => rolePool.includes(m) && !forbidden.includes(m));
  if (intersect.length > 0) {
    return { preset: intersect[seed % intersect.length], strategy: 'intersect' };
  }

  // 2. fallback role (ritmo > fit)
  const roleClean = rolePool.filter((m) => !forbidden.includes(m));
  if (roleClean.length > 0) {
    return { preset: roleClean[seed % roleClean.length], strategy: 'role-only' };
  }

  // 3. fallback image
  const imgClean = imgPool.filter((m) => !forbidden.includes(m));
  if (imgClean.length > 0) {
    return { preset: imgClean[seed % imgClean.length], strategy: 'image-only' };
  }

  // 4. último recurso
  return { preset: 'slow_push_in', strategy: 'default-fallback' };
}

/**
 * Sugestão de letterbox/intensity baseada em role.
 */
function selectFraming(role) {
  const FRAMING = {
    hook: { letterbox: 'progressive', intensity_target: 'medium' },
    context: { letterbox: 'fixed', intensity_target: 'low' },
    explanation: { letterbox: 'fixed', intensity_target: 'low' },
    suspense: { letterbox: 'fixed', intensity_target: 'medium' },
    discovery: { letterbox: 'fixed', intensity_target: 'medium' },
    climax: { letterbox: 'fixed', intensity_target: 'high' },
    rest: { letterbox: 'fixed', intensity_target: 'low' },
    closing: { letterbox: 'fixed', intensity_target: 'low' },
  };
  return FRAMING[role] || { letterbox: 'fixed', intensity_target: 'low' };
}

module.exports = { selectMove, selectFraming, IMAGE_TYPE_MOVES, ROLE_MOVES, FORBIDDEN };
