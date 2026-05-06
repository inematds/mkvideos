/**
 * lib/storytree-rhythm.js
 *
 * Regras de ritmo por formato. Define fases temporais com role recomendado
 * e shot duration típica por fase.
 *
 * Uso: dado o tempo cumulativo (t) e formato, retorna { phase, suggested_role,
 * shot_duration_target }.
 */

// Cada formato é uma sequência de fases com proporções relativas (0-1)
// Multiplicar pelo total_duration pra obter tempos absolutos.
const FORMATS = {
  // SHORT/REEL vertical 9:16 < 45s
  short_reel: {
    aspect: '9:16',
    target_duration_min: 15,
    target_duration_max: 60,
    phases: [
      { name: 'hook',         pct: [0.00, 0.05], role: 'hook',      shot_dur: [1.5, 3.0],  intensity: 'high' },
      { name: 'rapid',        pct: [0.05, 0.20], role: 'discovery', shot_dur: [1.5, 3.5],  intensity: 'medium' },
      { name: 'alternate',    pct: [0.20, 0.50], role: 'context',   shot_dur: [3.0, 6.0],  intensity: 'low' },
      { name: 'rising',       pct: [0.50, 0.78], role: 'suspense',  shot_dur: [2.5, 5.0],  intensity: 'medium' },
      { name: 'climax_close', pct: [0.78, 1.00], role: 'climax',    shot_dur: [1.5, 4.0],  intensity: 'high' },
    ],
  },

  // STORYTELLING / mini-doc, 30-90s
  storytelling: {
    aspect: 'any',
    target_duration_min: 30,
    target_duration_max: 120,
    phases: [
      { name: 'establish',   pct: [0.00, 0.08], role: 'hook',      shot_dur: [6.0, 10.0], intensity: 'low' },
      { name: 'context',     pct: [0.08, 0.30], role: 'context',   shot_dur: [5.0, 8.0],  intensity: 'low' },
      { name: 'development', pct: [0.30, 0.55], role: 'discovery', shot_dur: [3.0, 7.0],  intensity: 'medium' },
      { name: 'tension',     pct: [0.55, 0.75], role: 'suspense',  shot_dur: [2.0, 5.0],  intensity: 'medium' },
      { name: 'climax',      pct: [0.75, 0.88], role: 'climax',    shot_dur: [1.5, 3.0],  intensity: 'high' },
      { name: 'closing',     pct: [0.88, 1.00], role: 'closing',   shot_dur: [4.0, 8.0],  intensity: 'low' },
    ],
  },

  // MICRO-DOC vertical (Bedtime / hochelaga style), 25-40s
  micro_doc: {
    aspect: '9:16',
    target_duration_min: 20,
    target_duration_max: 40,
    phases: [
      { name: 'establish',   pct: [0.00, 0.15], role: 'hook',      shot_dur: [4.0, 8.0],  intensity: 'low' },
      { name: 'context',     pct: [0.15, 0.40], role: 'context',   shot_dur: [3.0, 6.0],  intensity: 'low' },
      { name: 'reveal',      pct: [0.40, 0.65], role: 'discovery', shot_dur: [2.0, 5.0],  intensity: 'medium' },
      { name: 'climax',      pct: [0.65, 0.80], role: 'climax',    shot_dur: [1.0, 2.5],  intensity: 'high' },
      { name: 'closing',     pct: [0.80, 1.00], role: 'closing',   shot_dur: [3.0, 5.0],  intensity: 'low' },
    ],
  },
};

/**
 * Retorna a fase ativa em t, dado formato e duração total.
 */
function getPhaseAt(format, t, totalDuration) {
  const fmt = FORMATS[format] || FORMATS.storytelling;
  const ratio = t / totalDuration;
  for (const phase of fmt.phases) {
    if (ratio >= phase.pct[0] && ratio < phase.pct[1]) return phase;
  }
  return fmt.phases[fmt.phases.length - 1]; // fim
}

/**
 * Distribui um número de shots ao longo das fases respeitando proporções.
 * Retorna array de { phase, role, shot_dur_target, intensity }.
 */
function distributeShots(format, totalDuration, numShots) {
  const fmt = FORMATS[format] || FORMATS.storytelling;
  const out = [];
  let cumulative = 0;

  // Aloca shots por fase proporcionalmente ao pct do range
  const phaseAllocs = fmt.phases.map((p) => {
    const range = p.pct[1] - p.pct[0];
    return { phase: p, range, alloc: 0 };
  });
  // Aloca shots por proporção de range (round)
  for (let i = 0; i < numShots; i++) {
    // Pega a fase com maior (range / (alloc+1))
    let best = phaseAllocs[0];
    let bestScore = best.range / (best.alloc + 1);
    for (const pa of phaseAllocs) {
      const s = pa.range / (pa.alloc + 1);
      if (s > bestScore) { best = pa; bestScore = s; }
    }
    best.alloc++;
  }

  // Gera shots na ordem das fases
  for (const pa of phaseAllocs) {
    const phaseDur = (pa.phase.pct[1] - pa.phase.pct[0]) * totalDuration;
    if (pa.alloc === 0) continue;
    const dur_per_shot = phaseDur / pa.alloc;
    const targetMin = pa.phase.shot_dur[0];
    const targetMax = pa.phase.shot_dur[1];
    const dur_clamped = Math.max(targetMin, Math.min(targetMax, dur_per_shot));
    for (let i = 0; i < pa.alloc; i++) {
      out.push({
        phase: pa.phase.name,
        role: pa.phase.role,
        shot_dur: dur_clamped,
        intensity: pa.phase.intensity,
        cumulative_start: cumulative,
      });
      cumulative += dur_clamped;
    }
  }

  return out;
}

module.exports = { FORMATS, getPhaseAt, distributeShots };
