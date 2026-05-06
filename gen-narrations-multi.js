/**
 * Gera TTS + whisper para um slug em 5 versões narrativas × 2 variantes (prof/generic).
 * Usa config/profissoes-narrations-multi.js para os textos.
 *
 * Uso: node gen-narrations-multi.js <slug>
 *      node gen-narrations-multi.js fisioterapeuta
 */

const fs = require('fs');
const { spawnSync } = require('child_process');
const { getNarration } = require('./config/profissoes-narrations-multi');
const { getCtaConfig } = require('./config/profissoes-cta');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node gen-narrations-multi.js <slug>');
  process.exit(1);
}

const VERSIONS = [1, 2, 3, 4, 5];
const VARIANTS = ['prof', 'generic'];
const t0 = Date.now();
let ok = 0;
let skip = 0;

for (const variant of VARIANTS) {
  const cta = getCtaConfig(slug, variant);
  for (const v of VERSIONS) {
    const bodyText = getNarration(slug, v);
    const fullText = `${cta.narrPrefix} ${bodyText}`;
    const narrFile = `/tmp/narr/narr-criaprof-cta-${variant}-${slug}-v${v}.mp3`;
    const whisperFile = `/tmp/narr/whisper-criaprof-cta-${variant}-${slug}-v${v}.json`;

    if (fs.existsSync(narrFile) && fs.statSync(narrFile).size > 10000) {
      console.log(`⏭ TTS ${variant}/v${v} já existe`);
      skip++;
    } else {
      console.log(`▶ TTS ${variant}/v${v}...`);
      const res = spawnSync('node', ['pipeline/generate-audio.js', narrFile, fullText, 'rachel'], { stdio: 'inherit' });
      if (res.status !== 0) { console.error(`❌ TTS ${variant}/v${v}`); continue; }
    }

    if (fs.existsSync(whisperFile)) {
      console.log(`⏭ Whisper ${variant}/v${v} já existe`);
      skip++;
    } else {
      console.log(`▶ Whisper ${variant}/v${v}...`);
      const cmd = `source /home/nmaldaner/miniconda3/etc/profile.d/conda.sh && conda activate chatterbox && python3 transcribe-words.py ${narrFile} ${whisperFile}`;
      const res = spawnSync('bash', ['-c', cmd], { stdio: 'inherit' });
      if (res.status !== 0) { console.error(`❌ Whisper ${variant}/v${v}`); continue; }
    }

    ok++;
  }
}

const total = VERSIONS.length * VARIANTS.length;
console.log(`\n✅ ${ok} gerados, ${skip} skipped de ${total * 2} etapas em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
