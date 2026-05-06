/**
 * Gera 10 narrações + whispers pra fisioterapeuta (5 estilos × 2 variantes prof/generic).
 * v1-v5 são os estilos novos de A/B testing (interativos). v0 (original) já existe cached.
 *
 * Uso: node gen-fisio-narrations-multi.js
 */

const fs = require('fs');
const { spawnSync } = require('child_process');

const NARRATIONS = {
  1: 'Você lembra quando tudo era manual? Você cuidou do paciente com as mãos, aprendeu bola, pilates, TENS, videochamada. Cada onda você adaptou. Agora a IA personaliza cada protocolo. E você? Continua sendo a que cura. Inema ponto CLUB te espera.',
  2: 'Lembra como tudo era diferente quando você começou? Anotação no papel, equipamento manual, paciente que voltava sem agenda. Sempre que mudou, você mudou junto. Agora a IA chegou — e você já sabe o que fazer. Continue aprendendo no Inema ponto CLUB.',
  3: 'Pensa rápido: quantas vezes essa profissão mudou desde que você começou? Bola, pilates, TENS, videochamada, telemedicina. Você sempre adaptou. Agora chegou a IA. Você sabe o que fazer. Continue aprendendo no Inema ponto CLUB.',
  4: 'Você consegue lembrar quantas vezes essa profissão se reinventou? Da bola ao pilates. Do papel ao prontuário digital. Da consulta presencial à videochamada. Cada vez você esteve lá. Agora é a IA. E você já sabe: continua sendo a que cura. Inema ponto CLUB.',
  5: 'E se eu te disser que você já viveu isso antes? Você passou da bola ao pilates. Do papel ao digital. Da consulta presencial à videochamada. Cada vez você adaptou. Agora a IA personaliza cada protocolo. Você sabe. Continue aprendendo no Inema ponto CLUB.',
};

const PREFIXES = {
  prof: 'A fisioterapia mudou. E agora?',
  generic: 'A sua profissão mudou. E agora?',
};

const slug = 'fisioterapeuta';
const t0 = Date.now();
let ok = 0;

for (const variant of ['prof', 'generic']) {
  for (const v of Object.keys(NARRATIONS)) {
    const fullText = `${PREFIXES[variant]} ${NARRATIONS[v]}`;
    const narrFile = `/tmp/narr/narr-criaprof-cta-${variant}-${slug}-v${v}.mp3`;
    const whisperFile = `/tmp/narr/whisper-criaprof-cta-${variant}-${slug}-v${v}.json`;

    if (fs.existsSync(narrFile) && fs.statSync(narrFile).size > 10000) {
      console.log(`⏭ TTS ${variant}/v${v} já existe`);
    } else {
      console.log(`▶ TTS ${variant}/v${v}...`);
      const res = spawnSync('node', ['pipeline/generate-audio.js', narrFile, fullText, 'bella'], { stdio: 'inherit' });
      if (res.status !== 0) { console.error(`❌ TTS ${variant}/v${v}`); continue; }
    }

    if (fs.existsSync(whisperFile)) {
      console.log(`⏭ Whisper ${variant}/v${v} já existe`);
    } else {
      console.log(`▶ Whisper ${variant}/v${v}...`);
      const cmd = `source /home/nmaldaner/miniconda3/etc/profile.d/conda.sh && conda activate chatterbox && python3 transcribe-words.py ${narrFile} ${whisperFile}`;
      const res = spawnSync('bash', ['-c', cmd], { stdio: 'inherit' });
      if (res.status !== 0) { console.error(`❌ Whisper ${variant}/v${v}`); continue; }
    }
    ok += 1;
  }
}

console.log(`\n✅ ${ok}/10 narrações prontas em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
