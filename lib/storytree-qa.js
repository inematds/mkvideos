/**
 * lib/storytree-qa.js
 *
 * Validações pré-render de um shot plan completo.
 * Retorna { ok, errors, warnings } — bloqueia render se errors.length > 0.
 */

const { PRESETS } = require('./storytree-presets');

const ROLES = ['hook', 'context', 'explanation', 'suspense', 'discovery', 'climax', 'rest', 'closing'];
const IMAGE_CLASSES = ['face', 'landscape', 'product', 'document', 'object_small', 'abstract', 'dark', 'group', 'architecture', 'map', 'unknown'];

function validateShot(shot, idx, opts) {
  const errors = [];
  const warnings = [];
  const { output_w = 540, output_h = 960 } = opts || {};

  // shape básico
  if (!shot.shot_id) errors.push(`shot[${idx}]: missing shot_id`);
  if (!shot.motion?.preset) errors.push(`shot[${idx}] (${shot.shot_id}): missing motion.preset`);
  if (!shot.timing?.duration) errors.push(`shot[${idx}] (${shot.shot_id}): missing timing.duration`);
  if (!shot.role) warnings.push(`shot[${idx}] (${shot.shot_id}): missing role (recommended for QA)`);

  if (shot.role && !ROLES.includes(shot.role)) {
    warnings.push(`shot[${idx}] (${shot.shot_id}): unknown role "${shot.role}" (expected: ${ROLES.join('|')})`);
  }
  if (shot.image_class && !IMAGE_CLASSES.includes(shot.image_class)) {
    warnings.push(`shot[${idx}] (${shot.shot_id}): unknown image_class "${shot.image_class}"`);
  }

  // preset existe?
  const preset = PRESETS[shot.motion?.preset];
  if (shot.motion?.preset && !preset) {
    errors.push(`shot[${idx}] (${shot.shot_id}): unknown preset "${shot.motion.preset}"`);
  }

  // duração razoável
  if (shot.timing?.duration < 0.4) errors.push(`shot[${idx}] (${shot.shot_id}): duration ${shot.timing.duration}s < 0.4s (minimum)`);
  if (shot.timing?.duration > 30) warnings.push(`shot[${idx}] (${shot.shot_id}): duration ${shot.timing.duration}s > 30s (very long shot)`);

  // duração fora do typical_dur do preset?
  if (preset?.typical_dur) {
    const [min, max] = preset.typical_dur;
    if (shot.timing.duration < min * 0.6) {
      warnings.push(`shot[${idx}] (${shot.shot_id}): duration ${shot.timing.duration}s < typical ${min}s for preset ${shot.motion.preset}`);
    } else if (shot.timing.duration > max * 1.6) {
      warnings.push(`shot[${idx}] (${shot.shot_id}): duration ${shot.timing.duration}s > typical ${max}s for preset ${shot.motion.preset}`);
    }
  }

  // zoom vs resolução de origem
  const scaleMax = Math.max(
    shot.motion?.scale_from ?? preset?.scale_from ?? 1,
    shot.motion?.scale_to ?? preset?.scale_to ?? 1,
  );
  if (shot.image_resolution) {
    const [imgW, imgH] = shot.image_resolution;
    const ratioW = imgW / output_w;
    const ratioH = imgH / output_h;
    const minRatio = Math.min(ratioW, ratioH);
    if (scaleMax > 1.25 && minRatio < 1.5) {
      errors.push(
        `shot[${idx}] (${shot.shot_id}): scale_max ${scaleMax} on image ${imgW}x${imgH} for output ${output_w}x${output_h} → will pixelate (recommend src ≥ 2x output)`,
      );
    }
    if (scaleMax > 1.4 && minRatio < 2.5) {
      warnings.push(
        `shot[${idx}] (${shot.shot_id}): scale_max ${scaleMax} requires very high-res source (src ratio ${minRatio.toFixed(2)}x output)`,
      );
    }
  }

  // avoid_crop coerência (heurística sem vision: alerta se crop forte + face_micro_push)
  if (preset?.avoid_crop && scaleMax > 1.10) {
    warnings.push(
      `shot[${idx}] (${shot.shot_id}): preset ${shot.motion.preset} has avoid_crop ${JSON.stringify(preset.avoid_crop)} but scale_max ${scaleMax} > 1.10 (risk of cropping protected region)`,
    );
  }

  return { errors, warnings };
}

function validateShotPlan(shots, opts = {}) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(shots) || shots.length === 0) {
    errors.push('shot plan vazio ou inválido');
    return { ok: false, errors, warnings };
  }

  // valida cada shot
  for (let i = 0; i < shots.length; i++) {
    const r = validateShot(shots[i], i, opts);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }

  // padrões cross-shot
  // 1. mesmo preset em > 3 shots seguidos
  let runPreset = 1;
  let lastPreset = shots[0]?.motion?.preset;
  for (let i = 1; i < shots.length; i++) {
    const p = shots[i]?.motion?.preset;
    if (p === lastPreset) runPreset++;
    else { runPreset = 1; lastPreset = p; }
    if (runPreset > 3) {
      warnings.push(`run of ${runPreset} consecutive shots using preset "${p}" (max recommended: 3)`);
      break;
    }
  }

  // 2. shot 0 deve ser hook ou establish
  const firstRole = shots[0]?.role;
  if (firstRole && !['hook', 'context'].includes(firstRole)) {
    warnings.push(`shot[0] role is "${firstRole}" (recommended: hook or context for first shot)`);
  }

  // 3. transições mais longas que o shot
  for (let i = 0; i < shots.length; i++) {
    const t = shots[i].transition;
    if (t?.in_duration && t.in_duration > shots[i].timing?.duration) {
      errors.push(`shot[${i}] (${shots[i].shot_id}): transition.in_duration ${t.in_duration}s > shot.duration ${shots[i].timing.duration}s`);
    }
  }

  // 4. caption length
  for (let i = 0; i < shots.length; i++) {
    const cap = shots[i].caption?.text;
    if (cap && cap.length > 80) {
      warnings.push(`shot[${i}] (${shots[i].shot_id}): caption ${cap.length} chars > 80 (recommend split)`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, total: shots.length };
}

function printReport(report) {
  const { ok, errors, warnings, total } = report;
  const status = ok ? 'PASS' : 'FAIL';
  const lines = [`[QA ${status}] ${total} shots — ${errors.length} errors, ${warnings.length} warnings`];
  for (const e of errors) lines.push(`  ERROR: ${e}`);
  for (const w of warnings) lines.push(`  WARN:  ${w}`);
  return lines.join('\n');
}

module.exports = { validateShot, validateShotPlan, printReport, ROLES, IMAGE_CLASSES };
