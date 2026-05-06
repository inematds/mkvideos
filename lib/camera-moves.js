/**
 * Vocabulário de movimentos de câmera (fpfilm1) → ffmpeg vf strings.
 *
 * Cada move recebe { dur, fps, w, h } e retorna a parte zoompan/scale do vf.
 * O scaling 2x é responsabilidade do caller (passa antes pra suavizar).
 *
 * Referência conceitual: https://inematds.github.io/fpfilm1/curso/trilha4/movimentos-camera.html
 */

const MOVES = ['pan', 'tilt', 'zoom-in', 'zoom-out', 'dolly-in', 'tracking', 'truck', 'pedestal',
  'handheld', 'static', 'push', 'pull', 'whip-pan', 'dolly-zoom', 'crane', 'orbit'];

function buildMove(name, opts) {
  const { dur, fps, w, h, idx = 0 } = opts;
  const frames = Math.max(1, Math.round(dur * fps));
  const cx = 'iw/2-(iw/zoom/2)';
  const cy = 'ih/2-(ih/zoom/2)';
  const zp = (z, x, y) => `zoompan=z='${z}':d=${frames}:x='${x}':y='${y}':s=${w}x${h}:fps=${fps}`;

  switch ((name || '').toLowerCase()) {
    case 'pan': // rotação horizontal (lento, amplo)
      return zp('1.10', `${cx}+(on*200/${frames}-100)`, cy);
    case 'tilt': // rotação vertical
      return zp('1.10', cx, `${cy}+(on*150/${frames}-75)`);
    case 'zoom-in':
    case 'push':
    case 'push-in':
      return zp(`1.0+0.20*on/${frames}`, cx, cy);
    case 'zoom-out':
    case 'pull':
    case 'pull-back':
      return zp(`1.25-0.25*on/${frames}`, cx, cy);
    case 'dolly-in': // avanço com leve descida (simula câmera baixando enquanto avança)
      return zp(`1.0+0.18*on/${frames}`, cx, `${cy}+(on*30/${frames})`);
    case 'tracking': // acompanha sujeito — pan rápido constante
      return zp('1.12', `${cx}+(on*350/${frames}-175)`, cy);
    case 'truck': // lateral lento (parallax)
      return zp('1.08', `${cx}+(on*120/${frames}-60)`, cy);
    case 'pedestal': // sobe/desce vertical (sem rotação) — usa idx pra alternar direção
      return zp('1.10', cx, `${cy}+(${idx % 2 === 0 ? 1 : -1}*on*120/${frames}-${idx % 2 === 0 ? 60 : -60})`);
    case 'handheld': // shake constante via random
      return zp(`1.05+0.05*on/${frames}`, `${cx}+random(${idx})*8`, `${cy}+random(${idx + 1})*8`);
    case 'static':
      return zp('1.05', cx, cy);
    case 'whip-pan': // pan ULTRA rápido (toda imagem em ~30% do shot)
      return zp('1.20', `${cx}+(${idx % 2 === 0 ? 1 : -1}*min(on*15,${frames * 200 / frames * 5}))`, cy);
    case 'dolly-zoom': // zoom OUT enquanto crop avança = vertigo (limitado em 2D)
      return zp(`1.30-0.30*on/${frames}`, `${cx}+(on*60/${frames}-30)`, cy);
    case 'crane':
    case 'jib': // tilt + pan combinados em arco
      return zp(`1.0+0.10*on/${frames}`, `${cx}+(on*150/${frames}-75)`, `${cy}-(on*100/${frames}-50)`);
    case 'orbit': // sem 3D real — fake com leve curva (pan+tilt sinuoso)
      return zp('1.10', `${cx}+sin(on/${frames}*2*PI)*100`, `${cy}+cos(on/${frames}*2*PI)*60`);
    default:
      // fallback: drift suave
      return zp(`1.05+0.05*on/${frames}`, cx, cy);
  }
}

/**
 * Gera o vf completo: scale 2x + move + (extras como vignette/grade) + fade.
 * extras = string adicional (ex: vignette, eq, etc) — ou null.
 */
function buildVF(move, opts) {
  const { dur, fps, w, h, idx, extras = '', fadeIn = 0, fadeOut = 0 } = opts;
  const SCALE = `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2}`;
  const motion = buildMove(move, { dur, fps, w, h, idx });
  const parts = [SCALE, motion];
  if (extras) parts.push(extras);
  if (fadeIn > 0) parts.push(`fade=t=in:st=0:d=${fadeIn}`);
  if (fadeOut > 0) parts.push(`fade=t=out:st=${(dur - fadeOut).toFixed(2)}:d=${fadeOut}`);
  return parts.filter(Boolean).join(',');
}

module.exports = { MOVES, buildMove, buildVF };
