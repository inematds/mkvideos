#!/usr/bin/env node
/**
 * Gen DarkStory Cinematic — versão multi-shot por beat com continuidade textual.
 *
 * Diferencial vs gen-darkstory.js:
 *   - Cada beat narrativo tem 1-5 shots (wide/medium/close/insert/OTS/POV)
 *   - subject_lock por entidade recorrente (Krampus, Floresta, Criança) repetido em todos os prompts
 *   - Pacing variável: hook 4s, darkest 10s, etc (não uniforme)
 *
 * Saída:
 *   output/videos/darkstory/<slug>-cinematic_<date>/
 *     imgs/beat01_shot01_wide.jpg ... beat11_shot01_wide.jpg (~30 imgs)
 *     beat_plan.json
 *     meta.json
 *
 * Uso: node gen-darkstory-cinematic.js --titulo "<assunto>" [--duracao 60] [--formato 9:16]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { generateImage } = require('./pipeline/generate-image-inemaimg');

const DEFAULTS = { duracao: 60, voz: 'rachel', captions: true, formato: '9:16' };

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === '--captions') { out.captions = true; continue; }
    if (k === '--no-captions') { out.captions = false; continue; }
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const v = argv[i + 1];
      if (v && !v.startsWith('--')) { out[key] = isNaN(v) ? v : Number(v); i += 1; }
    }
  }
  return out;
}

function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

const args = parseArgs(process.argv);
if (!args.titulo) {
  console.error('Uso: node gen-darkstory-cinematic.js --titulo "<assunto>" [--duracao 60] [--formato 9:16]');
  process.exit(1);
}

const baseSlug = slugify(args.titulo);
const slug = `${baseSlug}-cinematic`;
const DATE = new Date().toISOString().slice(0, 10);
const OUT = path.join(__dirname, `output/videos/darkstory/${slug}_${DATE}`);
const IMGS_DIR = path.join(OUT, 'imgs');
fs.mkdirSync(IMGS_DIR, { recursive: true });

const RATIO = args.formato === '16:9' ? '16:9' : (args.formato === '1:1' ? '1:1' : '9:16');
const MODEL = 'flux2-klein';

const planPath = path.join(OUT, 'beat_plan.json');

function generateBeatPlan() {
  if (fs.existsSync(planPath)) {
    console.log(`[${slug}] beat_plan.json já existe — reusando`);
    return JSON.parse(fs.readFileSync(planPath, 'utf-8'));
  }

  const prompt = `Você é diretor/roteirista de canal "dark" do YouTube com background em cinema.
Gere um BEAT PLAN cinematográfico em JSON puro (sem markdown) para o tema:

TEMA: "${args.titulo}"
DURAÇÃO ALVO: ${args.duracao}s · FORMATO: ${RATIO} · IDIOMA: PT-BR

DIFERENCIAL: cada beat narrativo tem MÚLTIPLOS PLANOS (cinema, não slideshow). Use:
- "wide" — plano aberto, estabelecedor (4-6s)
- "medium" — meio corpo, ação (2-3s)
- "close" — close no rosto/objeto, emoção (1.5-2.5s)
- "insert" — detalhe de objeto (1-1.5s) — corrente, vela, mão, lâmina
- "ots" — over-the-shoulder (2-3s)
- "pov" — primeira pessoa (1.5-2s) — o personagem vendo

ESTRUTURA OBRIGATÓRIA (otimizada pra retenção):

1. HOOK (4s, 3 shots quick — wide → close rosto → insert objeto): pergunta provocativa OU stat chocante. Para a rolagem.

2-5. BUILD-UP (4-6s cada, 2-4 shots): apresenta o lado sombrio gradualmente. Use shots variados (wide pra contexto, close pra tensão, inserts pra simbolismo).

6. MID PATTERN INTERRUPT (3s, 2 shots rápidos): pergunta direta ao espectador OU revelação parcial. Cria pausa.

7. DARKEST MOMENT (~10s, 5 shots — wide medo → medium ação → close rosto vítima → POV de ser perseguido → wide afastando-se da cena): a cena climática. DWELL aqui.

8-10. RESOLUTION (4-5s cada, 2-3 shots): contextualiza, conecta com o presente.

11. CTA FINAL (4s, 1 shot wide pull-back): "se inscreva" sutil + frase que abre próximo vídeo.

OUTPUT — array de beats em JSON. Cada beat:
{
  "beat": 1..11,
  "role": "hook" | "buildup" | "mid" | "darkest" | "resolution" | "cta",
  "duration_s": 4..10,
  "narration": "texto PT-BR (~${'duracao' in args ? Math.round(args.duracao / 11 * 2.5) : 12} palavras por beat — escala com duração)",
  "caption": "frase curta MAIÚSCULAS 4-7 palavras",
  "shots": [
    {
      "n": 1..5,
      "type": "wide|medium|close|insert|ots|pov",
      "duration_s": 1..6,
      "visual_prompt": "prompt EM INGLÊS para flux2-klein. SEMPRE inclua o subject_lock relevante quando aplicável. Estilo: cinematic dark, low-key lighting, deep shadows, atmospheric fog, muted palette with single warm highlight, no text/logos/captions. Aspect ${RATIO}.",
      "subject_lock": "krampus|floresta|crianca|igreja|nenhum (referência semântica pra continuidade)"
    }
  ]
}

CONTINUIDADE VISUAL — sempre que um shot mostrar:
- KRAMPUS: incluir literalmente "horned masked humanoid in shaggy matted black fur coat, long red tongue, rusted iron chains, holding birch switches, glowing yellow eyes, weathered demonic features"
- FLORESTA SOMBRIA: incluir "deep snowy black pine forest at night, heavy fog, blue moonlight, single warm torch glow far away"
- CRIANÇA AMEDRONTADA: incluir "thin pale child in tattered sleepwear, terrified expression, small scale"
- IGREJA: incluir "gothic stone church interior, candlelight, faded medieval frescoes"

Soma das durações dos beats = ${args.duracao}±2s. Soma das durações dos shots = duration_s do beat.

Saia APENAS o JSON do array. Comece com [ termine com ].`;

  console.log(`[${slug}] chamando Claude CLI (multi-shot beat plan)...`);
  const t0 = Date.now();
  const r = spawnSync('claude', ['-p', prompt, '--dangerously-skip-permissions'], {
    encoding: 'utf-8', maxBuffer: 8 * 1024 * 1024, timeout: 360000,
  });
  if (r.status !== 0) { console.error('Claude CLI falhou:', r.stderr || r.error?.message); process.exit(1); }

  let text = (r.stdout || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let beats;
  try { beats = JSON.parse(text); } catch {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) try { beats = JSON.parse(m[0]); } catch {}
  }
  if (!Array.isArray(beats) || beats.length === 0) {
    console.error('Beat plan inválido. Resposta:', text.slice(0, 800)); process.exit(1);
  }

  const totalShots = beats.reduce((a, b) => a + (b.shots?.length || 0), 0);
  const totalDur = beats.reduce((a, b) => a + (b.duration_s || 0), 0);
  console.log(`[${slug}] ✅ ${beats.length} beats · ${totalShots} shots · ${totalDur.toFixed(1)}s em ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  fs.writeFileSync(planPath, JSON.stringify(beats, null, 2));
  return beats;
}

async function generateImages(beats) {
  const all = [];
  for (const beat of beats) {
    for (const shot of (beat.shots || [])) {
      const fname = `beat${String(beat.beat).padStart(2, '0')}_shot${String(shot.n).padStart(2, '0')}_${shot.type}.jpg`;
      all.push({ beat, shot, fname, path: path.join(IMGS_DIR, fname) });
    }
  }
  console.log(`[${slug}] gerando ${all.length} imagens (${MODEL}, ${RATIO})...`);
  let ok = 0, fail = 0, skipped = 0;
  for (let i = 0; i < all.length; i += 1) {
    const a = all[i];
    if (fs.existsSync(a.path)) { console.log(`── ${i + 1}/${all.length} ${a.fname} (skip)`); skipped += 1; continue; }
    process.stdout.write(`── ${i + 1}/${all.length} [${a.beat.role.padEnd(11)}] ${a.shot.type.padEnd(7)} ... `);
    try { await generateImage(a.path, a.shot.visual_prompt, MODEL, RATIO); ok += 1; console.log('✓'); }
    catch (e) { fail += 1; console.log(`✗ ${e.message.slice(0, 80)}`); }
  }
  return { ok, fail, skipped, total: all.length };
}

(async () => {
  const t0 = Date.now();
  const meta = { titulo: args.titulo, slug, date: DATE, params: args, started_at: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));

  const beats = generateBeatPlan();
  const r = await generateImages(beats);

  meta.beats = beats.length;
  meta.total_shots = r.total;
  meta.imgs_ok = r.ok; meta.imgs_fail = r.fail; meta.imgs_skipped = r.skipped;
  meta.finished_at = new Date().toISOString();
  meta.elapsed_s = parseFloat(((Date.now() - t0) / 1000).toFixed(1));
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));

  console.log(`\n[${slug}] ✅ ${r.ok}/${r.total} imgs em ${meta.elapsed_s}s`);
  console.log(`  → ${OUT}`);
  console.log(`  Próximo: node render-darkstory-cinematic.js ${slug}_${DATE}`);
})().catch((e) => { console.error('FATAL:', e.stack || e.message); process.exit(1); });
