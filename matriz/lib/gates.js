/**
 * gates.js — lógica de gate=sample: escolhe N profissões diversificadas por área.
 */

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Escolhe N profissões diversificadas por área usando RNG determinística.
 * @param {Array} catalog - lista de profissões (cada uma pode ter .area)
 * @param {number} n - quantas profissões retornar
 * @param {number} [seed=Date.now()] - semente para RNG determinística
 * @returns {Array} amostra com no máximo N profissões, diversificadas por área
 */
function pickSample(catalog, n, seed = Date.now()) {
  if (!catalog.length) return [];
  const rng = mulberry32(seed);
  const byArea = new Map();
  for (const p of catalog) {
    const a = p.area || '_default';
    if (!byArea.has(a)) byArea.set(a, []);
    byArea.get(a).push(p);
  }
  const areas = [...byArea.keys()];
  const sample = [];
  const targetN = Math.min(n, catalog.length);
  while (sample.length < targetN && areas.length) {
    for (const a of [...areas]) {
      const list = byArea.get(a);
      if (!list || !list.length) {
        const idx = areas.indexOf(a);
        if (idx >= 0) areas.splice(idx, 1);
        continue;
      }
      const idx = Math.floor(rng() * list.length);
      sample.push(list.splice(idx, 1)[0]);
      if (sample.length >= targetN) break;
    }
  }
  return sample;
}

module.exports = { pickSample };
