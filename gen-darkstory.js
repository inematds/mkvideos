#!/usr/bin/env node
/**
 * Factory DarkStory — gera roteiro + N imagens para vídeos do canal dark.
 *
 * Pipeline:
 *   1. Claude CLI gera scene_plan.json com estrutura narrativa otimizada para retenção:
 *      - Hook 0-15s (pergunta/stat chocante)
 *      - Build-up 15-50%
 *      - Darkest moment 60-70%
 *      - Resolution + CTA final
 *   2. inemaimg API gera 1 imagem por cena (prompt visual sombrio + cinematográfico)
 *   3. Saída: output/videos/darkstory/<slug>_<date>/
 *               imgs/cena01.jpg ... cenaNN.jpg
 *               scene_plan.json
 *               meta.json
 *
 * Uso:
 *   node gen-darkstory.js --titulo "<assunto>" [--duracao 60] [--n_imgs 12]
 *                         [--voz josh] [--captions] [--formato 9:16] [--musica dark]
 *
 * Defaults: duracao=60s, n_imgs=12 (1 a cada ~5s), voz=josh, captions=on, formato=9:16, musica=dark
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { generateImage } = require('./pipeline/generate-image-inemaimg');

const DEFAULTS = {
  duracao: 60,
  n_imgs: 12,
  voz: 'rachel', // chatterbox daemon só tem rachel/bella; outras dão fallback no render
  captions: true,
  formato: '9:16',
  musica: 'dark',
};

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === '--captions') { out.captions = true; continue; }
    if (k === '--no-captions') { out.captions = false; continue; }
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const v = argv[i + 1];
      if (v && !v.startsWith('--')) {
        out[key] = isNaN(v) ? v : Number(v);
        i += 1;
      }
    }
  }
  return out;
}

function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

const args = parseArgs(process.argv);
if (!args.titulo) {
  console.error('Uso: node gen-darkstory.js --titulo "<assunto>" [--duracao 60] [--n_imgs 12] [--voz josh] [--captions] [--formato 9:16] [--musica dark]');
  console.error('Defaults:', DEFAULTS);
  process.exit(1);
}

const slug = slugify(args.titulo);
const DATE = new Date().toISOString().slice(0, 10);
const OUT = path.join(__dirname, `output/videos/darkstory/${slug}_${DATE}`);
const IMGS_DIR = path.join(OUT, 'imgs');
fs.mkdirSync(IMGS_DIR, { recursive: true });

const RATIO = args.formato === '16:9' ? '16:9' : (args.formato === '1:1' ? '1:1' : '9:16');
const MODEL = 'flux2-klein';

// ── Step 1: Claude CLI gera scene_plan.json ────────────────────────────────
const planPath = path.join(OUT, 'scene_plan.json');

function generateScenePlan() {
  if (fs.existsSync(planPath)) {
    console.log(`[darkstory:${slug}] scene_plan.json já existe — reaproveitando`);
    return JSON.parse(fs.readFileSync(planPath, 'utf-8'));
  }

  const sceneSec = args.duracao / args.n_imgs;
  const darkestIdx = Math.floor(args.n_imgs * 0.65); // 65% do runtime
  const midIdx = Math.floor(args.n_imgs * 0.5);

  const prompt = `Você é roteirista de canal "dark" do YouTube (estilo "horror histórico", "lados sombrios da história", "lendas reais"). Gere um roteiro em JSON puro (sem markdown) para o tema:

TEMA: "${args.titulo}"

Especificações:
- Duração total: ${args.duracao}s
- ${args.n_imgs} cenas (~${sceneSec.toFixed(1)}s cada)
- Idioma: PT-BR
- Tom: sombrio, intrigante, baseado em fatos reais ou folclore quando possível, sem exagero comédico

Estrutura narrativa OBRIGATÓRIA (otimizada pra retenção):
- Cena 1 (HOOK 0-${sceneSec.toFixed(0)}s): pergunta provocativa OU dado chocante OU afirmação contraintuitiva. Para a rolagem.
- Cenas 2-${midIdx}: BUILD-UP — apresenta o contexto, o "lado sombrio", cria curiosidade.
- Cena ${midIdx + 1} (MID-RETENTION): pattern interrupt — pergunta direta ao espectador OU revelação parcial.
- Cena ${darkestIdx + 1} (DARKEST MOMENT — ~65% do runtime): a parte mais sombria, perturbadora, climática.
- Cenas ${darkestIdx + 2}-${args.n_imgs - 1}: RESOLUÇÃO — explica, contextualiza, conecta com o presente.
- Cena ${args.n_imgs} (CTA): chamada pra inscrição/próximo vídeo. Algo como "se inscreva pra mais histórias do lado obscuro" mas sutil.

Para cada cena gere:
{
  "n": 1..${args.n_imgs},
  "role": "hook" | "buildup" | "mid" | "darkest" | "resolution" | "cta",
  "duracao_s": ${sceneSec.toFixed(1)} (pode variar +/- 1s),
  "narration": "texto da narração nessa cena (PT-BR, ~${Math.round(sceneSec * 2.5)} palavras pra caber em ${sceneSec.toFixed(0)}s)",
  "caption": "frase curta da cena (~5-8 palavras, MAIÚSCULAS, impacto)",
  "visual_prompt": "prompt em INGLÊS para gerador de imagem flux2-klein. Estilo: cinematic dark, low-key lighting, deep shadows, atmospheric, fog/mist when relevant, muted colors with single warm highlight (candle, fire, lantern). NÃO inclua texto/captions/logos na imagem. Aspect ratio: ${RATIO}."
}

Saia APENAS o JSON do array de cenas. Sem markdown, sem explicação. Comece com [ e termine com ].`;

  console.log(`[darkstory:${slug}] chamando Claude CLI...`);
  const t0 = Date.now();
  const result = spawnSync('claude', ['-p', prompt, '--dangerously-skip-permissions'], {
    encoding: 'utf-8',
    maxBuffer: 5 * 1024 * 1024,
    timeout: 240000,
  });

  if (result.status !== 0) {
    console.error('Claude CLI falhou:', result.stderr || result.error?.message);
    process.exit(1);
  }

  let text = (result.stdout || '').trim();
  // Limpa fences markdown se vieram
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  let scenes;
  try {
    scenes = JSON.parse(text);
  } catch (e) {
    // Tenta achar o JSON dentro do texto
    const m = text.match(/\[[\s\S]*\]/);
    if (m) {
      try { scenes = JSON.parse(m[0]); } catch { /* throw below */ }
    }
    if (!scenes) {
      console.error('Erro parse JSON Claude:', e.message);
      console.error('Resposta:', text.slice(0, 500));
      process.exit(1);
    }
  }

  if (!Array.isArray(scenes) || scenes.length === 0) {
    console.error('Scene plan inválido (não é array):', scenes);
    process.exit(1);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[darkstory:${slug}] ✅ ${scenes.length} cenas geradas em ${elapsed}s`);

  fs.writeFileSync(planPath, JSON.stringify(scenes, null, 2));
  return scenes;
}

// ── Step 2: gera 1 img por cena via inemaimg ───────────────────────────────
async function generateImages(scenes) {
  console.log(`[darkstory:${slug}] gerando ${scenes.length} imagens (model=${MODEL}, ratio=${RATIO})...`);
  let ok = 0, fail = 0, skipped = 0;
  for (let i = 0; i < scenes.length; i += 1) {
    const s = scenes[i];
    const n = String(s.n || (i + 1)).padStart(2, '0');
    const out = path.join(IMGS_DIR, `cena${n}.jpg`);
    if (fs.existsSync(out)) { console.log(`── ${i + 1}/${scenes.length} ── cena${n}.jpg (skip, já existe)`); skipped += 1; continue; }
    process.stdout.write(`── ${i + 1}/${scenes.length} ── ${s.role || ''} ... `);
    try {
      await generateImage(out, s.visual_prompt, MODEL, RATIO);
      ok += 1;
      console.log('✓');
    } catch (e) {
      fail += 1;
      console.log(`✗ (${e.message.slice(0, 80)})`);
    }
  }
  return { ok, fail, skipped };
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  const meta = {
    titulo: args.titulo,
    slug,
    date: DATE,
    params: args,
    started_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));

  const scenes = generateScenePlan();
  const r = await generateImages(scenes);

  meta.scenes = scenes.length;
  meta.imgs_ok = r.ok;
  meta.imgs_fail = r.fail;
  meta.imgs_skipped = r.skipped;
  meta.finished_at = new Date().toISOString();
  meta.elapsed_s = parseFloat(((Date.now() - t0) / 1000).toFixed(1));
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));

  console.log(`\n[darkstory:${slug}] ✅ done — imgs ${r.ok}/${scenes.length} (skip=${r.skipped} fail=${r.fail}) em ${meta.elapsed_s}s`);
  console.log(`  → ${OUT}`);
  console.log(`  Próximo: node render-darkstory.js ${slug}_${DATE}`);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
