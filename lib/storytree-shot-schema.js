/**
 * lib/storytree-shot-schema.js
 *
 * Factory + JSDoc schema do ShotPlan v1. Usado pra criar shots com defaults
 * sensatos a partir de input mínimo (image + role + duration).
 */

const { PRESETS } = require('./storytree-presets');
const { selectMove, selectFraming } = require('./storytree-selector');

/**
 * @typedef {Object} ImageFraming
 * @property {string} fit                 - "crop" | "contain" | "cover"
 * @property {string} safe_area           - "vertical_9_16" | "horizontal_16_9" | "square"
 * @property {string[]} avoid_crop        - regiões protegidas (ex: ["eyes","mouth","chin","text","logo"])
 *
 * @typedef {Object} Motion
 * @property {string} preset              - nome do preset em PRESETS
 * @property {number} [scale_from]        - override do preset
 * @property {number} [scale_to]
 * @property {[number,number]} [pan_x]    - override do pan x (-1 to 1, normalized)
 * @property {[number,number]} [pan_y]
 * @property {string} [easing]            - override do easing
 * @property {string} [intensity]         - "low" | "medium" | "high"
 *
 * @typedef {Object} Timing
 * @property {number} duration            - duração total em segundos
 * @property {number} [hold_start]        - segundos parado antes do move
 * @property {number} [hold_end]          - segundos parado depois do move
 *
 * @typedef {Object} Transition
 * @property {string} in_kind             - "hard_cut" | "cross_dissolve" | "flash" | "fade_black"
 * @property {number} [in_duration]       - segundos
 * @property {string} [out_kind]
 * @property {number} [out_duration]
 *
 * @typedef {Object} Caption
 * @property {string} text
 * @property {string} [position]          - "lower_third" | "center" | "upper_third"
 * @property {string} [animation]         - "fade" | "punch" | "type"
 *
 * @typedef {Object} ShotPlan
 * @property {string} shot_id
 * @property {string} role
 * @property {string} [image_id]
 * @property {string} [image_path]
 * @property {string} image_class
 * @property {[number,number]} [image_resolution]
 * @property {ImageFraming} framing
 * @property {Motion} motion
 * @property {Timing} timing
 * @property {Transition} [transition]
 * @property {Caption} [caption]
 * @property {string} letterbox           - "progressive" | "fixed" | "none"
 */

/**
 * Cria um ShotPlan completo a partir de input mínimo + selector.
 * Args mínimos: { id, role, image_class, duration, image_path }
 */
function createShot(input, opts = {}) {
  const {
    id, role, image_class = 'unknown', duration,
    image_path, image_id = id, image_resolution,
    preset_override, easing_override, scale_override,
    pan_x_override, pan_y_override,
    letterbox = 'fixed',
    transition_in = 'hard_cut', transition_in_dur = 0.04,
    transition_out, transition_out_dur,
    caption,
  } = input;

  if (!id) throw new Error('createShot: missing id');
  if (!role) throw new Error('createShot: missing role');
  if (!duration) throw new Error('createShot: missing duration');

  const seed = opts.seed ?? 0;
  const sel = preset_override
    ? { preset: preset_override, strategy: 'override' }
    : selectMove(image_class, role, seed);

  const preset = PRESETS[sel.preset];
  if (!preset) throw new Error(`createShot: preset "${sel.preset}" not found`);

  const framing = selectFraming(role);

  const shot = {
    shot_id: id,
    role,
    image_id,
    image_path,
    image_class,
    image_resolution,
    framing: {
      fit: 'crop',
      safe_area: 'vertical_9_16',
      avoid_crop: preset.avoid_crop || [],
    },
    motion: {
      preset: sel.preset,
      scale_from: scale_override?.[0] ?? preset.scale_from,
      scale_to: scale_override?.[1] ?? preset.scale_to,
      pan_x: pan_x_override ?? preset.pan_x ?? [0, 0],
      pan_y: pan_y_override ?? preset.pan_y ?? [0, 0],
      easing: easing_override ?? preset.easing,
      intensity: preset.intensity,
      _selector_strategy: sel.strategy,
    },
    timing: {
      duration,
      hold_start: input.hold_start ?? 0,
      hold_end: input.hold_end ?? 0,
    },
    transition: {
      in_kind: transition_in,
      in_duration: transition_in_dur,
      out_kind: transition_out,
      out_duration: transition_out_dur,
    },
    letterbox: framing.letterbox === 'progressive' && letterbox !== 'none' ? 'progressive' : letterbox,
    caption: caption ? {
      text: caption.text,
      position: caption.position || 'lower_third',
      animation: caption.animation || 'fade',
    } : undefined,
  };

  return shot;
}

/**
 * Atalho: distribui N shots de imagens em um plano completo respeitando ritmo.
 * Args:
 *   images: [{ id, path, image_class, resolution? }]
 *   format: 'short_reel' | 'storytelling' | 'micro_doc'
 *   total_duration: segundos
 *   transitions: array de { in_kind, in_duration } por shot (opcional)
 */
function buildPlanFromImages(images, format, total_duration, transitions = null) {
  const { distributeShots } = require('./storytree-rhythm');
  const layout = distributeShots(format, total_duration, images.length);

  if (layout.length !== images.length) {
    throw new Error(`buildPlanFromImages: ${layout.length} layout slots vs ${images.length} images`);
  }

  return images.map((img, i) => {
    const slot = layout[i];
    const shot = createShot({
      id: `s${String(i + 1).padStart(2, '0')}_${slot.phase}`,
      role: slot.role,
      image_class: img.image_class || 'unknown',
      image_id: img.id,
      image_path: img.path,
      image_resolution: img.resolution,
      duration: slot.shot_dur,
      letterbox: i === 0 ? 'progressive' : 'fixed',
      transition_in: transitions?.[i]?.in_kind ?? (i === 0 ? 'hard_cut' : 'cross_dissolve'),
      transition_in_dur: transitions?.[i]?.in_duration ?? (i === 0 ? 0.04 : 0.5),
    }, { seed: i });
    shot._phase = slot.phase;
    shot._intensity = slot.intensity;
    return shot;
  });
}

module.exports = { createShot, buildPlanFromImages };
