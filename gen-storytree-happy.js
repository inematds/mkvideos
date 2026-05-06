#!/usr/bin/env node
/**
 * gen-storytree-happy.js
 *
 * História completa "Uma Manhã, Um Cachorro, Uma Vida" — 60s, 9:16,
 * tema alegre/envolvente, gerada ponta-a-ponta com:
 *   - inemaimg (12 imgs novas)
 *   - storytree-classify (auto image_class do prompt)
 *   - storytree-shot-schema (plan factory)
 *   - storytree-qa (validação)
 *   - storytree-presets / storytree-rhythm (render)
 *
 * Output: output/videos/happy/uma-manha_<date>/video/storytree-happy.mp4
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { generateImage } = require('./pipeline/generate-image-inemaimg');
const { classifyBatch } = require('./lib/storytree-classify');
const { PRESETS, buildShotVF } = require('./lib/storytree-presets');
const { validateShotPlan, printReport } = require('./lib/storytree-qa');
const { buildPlanFromImages } = require('./lib/storytree-shot-schema');

const ROOT = '/home/nmaldaner/projetos/mkvideos';
const DATE = new Date().toISOString().slice(0, 10);
const SLUG = 'uma-manha';
const OUT = path.join(ROOT, 'output/videos/happy', `${SLUG}_${DATE}`);
const IMGS = path.join(OUT, 'imgs');
const VIDEO = path.join(OUT, 'video');
const TMP = path.join(OUT, 'tmp');
const MUSIC = path.join(ROOT, 'media/musicas/happy/emotional-piano.mp3');

fs.mkdirSync(IMGS, { recursive: true });
fs.mkdirSync(VIDEO, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const W = 540;
const H = 960;
const FPS = 30;
const PRE_W = Math.round(W * 1.5);
const PRE_H = Math.round(H * 1.5);
const TOTAL_DURATION = 58; // música tem 72s, deixamos folga
const FORMAT = 'storytelling';

// ================================================================
// SCENE PLAN — 12 cenas com prompts cuidadosamente escolhidos pra alegria
// ================================================================

const SCENES = [
  {
    id: 'i01',
    prompt: 'cinematic vertical 9:16, soft warm morning light streaming through bedroom window, sun rays on white sheets, peaceful empty room, golden hour, photorealistic, shallow depth of field',
  },
  {
    id: 'i02',
    prompt: 'cinematic close-up portrait of a young man in his 30s looking out a window with thoughtful hopeful expression, soft morning light on his face, gentle smile starting to form, photorealistic',
  },
  {
    id: 'i03',
    prompt: 'cinematic wide shot of a quiet residential street at sunrise, trees lining sidewalks, morning mist, warm orange light, empty calm street, suburban neighborhood, photorealistic',
  },
  {
    id: 'i04',
    prompt: 'cinematic wide shot of a small mixed-breed brown and white street dog sitting alone on a sidewalk, looking expectantly, morning sunlight, urban park background, soft focus, photorealistic',
  },
  {
    id: 'i05',
    prompt: 'cinematic close-up of a friendly mixed-breed dog face with soft brown eyes looking directly at camera, hopeful expression, warm morning light, photorealistic, shallow depth of field',
  },
  {
    id: 'i06',
    prompt: 'cinematic shot of a young man crouched down petting a happy street dog on a sunny sidewalk, both smiling, warm morning light, joyful moment, photorealistic',
  },
  {
    id: 'i07',
    prompt: 'cinematic wide shot of a man and a small brown dog walking together down a tree-lined sidewalk, morning shadows on pavement, warm golden light, photorealistic, vertical composition',
  },
  {
    id: 'i08',
    prompt: 'cinematic wide shot of children laughing on swings in a sunlit park, summer morning, warm golden light through leaves, joyful playful atmosphere, photorealistic',
  },
  {
    id: 'i09',
    prompt: 'cinematic close-up portrait of a young man laughing freely with eyes closed and pure joy, warm sunlight on his face, vibrant happy emotion, photorealistic',
  },
  {
    id: 'i10',
    prompt: 'cinematic wide shot of a small mixed-breed dog running joyfully across a green grass field in a sunlit park, motion blur, ears flying, pure happiness, photorealistic',
  },
  {
    id: 'i11',
    prompt: 'cinematic wide shot silhouette of a man and a dog sitting together on a park bench at golden hour sunset, warm orange sky, peaceful moment, photorealistic, vertical 9:16',
  },
  {
    id: 'i12',
    prompt: 'cinematic interior shot of a cozy living room at evening, warm lamp light, a small dog sleeping peacefully on a soft rug, photorealistic, intimate atmosphere',
  },
];

// ================================================================
// STEP 1 — Auto-classify cada cena via prompt
// ================================================================

const classified = classifyBatch(SCENES);
console.log('=== AUTO-CLASSIFY ===');
for (const s of classified) {
  console.log(`  ${s.id}: ${s.image_class.padEnd(15)} ← ${s.prompt.slice(0, 80)}...`);
}
console.log();

// ================================================================
// STEP 2 — Gera imagens via inemaimg (sequencial — server single-GPU)
// ================================================================

async function genImages() {
  const t0 = Date.now();
  console.log('=== GENERATING 12 IMAGES (inemaimg flux2-klein, 9:16) ===');
  for (const s of classified) {
    const out = path.join(IMGS, `${s.id}.png`);
    if (fs.existsSync(out)) {
      console.log(`  ${s.id}: cached`);
      s.path = out;
      s.resolution = [512, 896];
      continue;
    }
    const t = Date.now();
    process.stdout.write(`  ${s.id}: generating... `);
    try {
      await generateImage(out, s.prompt, 'flux2-klein', '9:16');
      const dt = ((Date.now() - t) / 1000).toFixed(1);
      console.log(`OK (${dt}s)`);
      s.path = out;
      s.resolution = [512, 896];
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      throw e;
    }
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Total: ${dt}s\n`);
}

// ================================================================
// STEP 3 — Build plan via factory + QA + auto-downgrade
// ================================================================

function buildAndValidate() {
  const plan = buildPlanFromImages(classified, FORMAT, TOTAL_DURATION);

  // Force climax preset to flash_cut (we want money shot punch)
  const climaxIdx = plan.findIndex((s) => s.role === 'climax');
  if (climaxIdx >= 0) {
    plan[climaxIdx].motion.preset = 'flash_cut';
    Object.assign(plan[climaxIdx].motion, {
      scale_from: PRESETS.flash_cut.scale_from,
      scale_to: PRESETS.flash_cut.scale_to,
      easing: PRESETS.flash_cut.easing,
    });
  }

  // Last shot fade-out
  plan[plan.length - 1]._fadeOutBlack = 1.5;

  // Auto-downgrade scale > 1.25 em img low-res
  for (const s of plan) {
    if (!s.image_resolution) continue;
    const scaleMax = Math.max(s.motion.scale_from, s.motion.scale_to);
    const minRes = Math.min(s.image_resolution[0] / W, s.image_resolution[1] / H);
    if (scaleMax > 1.25 && minRes < 1.5) {
      const old = [s.motion.scale_from, s.motion.scale_to];
      if (s.motion.scale_from > 1.20) s.motion.scale_from = 1.20;
      if (s.motion.scale_to > 1.20) s.motion.scale_to = 1.20;
      console.log(`  [auto-downgrade] ${s.shot_id}: ${old} → [${s.motion.scale_from}, ${s.motion.scale_to}]`);
    }
  }

  const qa = validateShotPlan(plan, { output_w: W, output_h: H });
  console.log(printReport(qa));
  if (!qa.ok) {
    fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify(qa, null, 2));
    throw new Error('QA FAIL — abortando render');
  }
  fs.writeFileSync(path.join(OUT, 'shot-plan.json'), JSON.stringify(plan, null, 2));
  fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify(qa, null, 2));

  console.log('\n=== SHOT PLAN ===');
  for (const s of plan) {
    const fade = s._fadeOutBlack ? ` +fade${s._fadeOutBlack}s` : '';
    console.log(
      `  ${s.shot_id.padEnd(20)} ${s.role.padEnd(10)} ${s.motion.preset.padEnd(28)} ` +
      `${s.timing.duration.toFixed(1)}s [${s.image_class}]${fade}`,
    );
  }
  console.log();
  return plan;
}

// ================================================================
// STEP 4 — Render shots + concat + audio
// ================================================================

function renderShot(shot, idx, total) {
  const out = path.join(TMP, `${String(idx).padStart(2, '0')}_${shot.shot_id}.mp4`);
  const vf = buildShotVF(shot, {
    W, H, FPS, PRE_W, PRE_H,
    fadeOutBlack: shot._fadeOutBlack ?? 0,
  });
  const cmd = [
    'ffmpeg -y',
    `-loop 1 -t ${shot.timing.duration} -i "${shot.image_path}"`,
    `-vf "${vf}"`,
    `-r ${FPS} -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p`,
    `"${out}"`,
  ].join(' ');
  console.log(`  [${idx + 1}/${total}] ${shot.shot_id} (${shot.timing.duration}s, ${shot.motion.preset})`);
  execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] });
  return { path: out, dur: shot.timing.duration, transition: shot.transition };
}

function concatWithXfade(rendered) {
  const out = path.join(TMP, 'video_no_audio.mp4');
  const inputs = rendered.map((s) => `-i "${s.path}"`).join(' ');
  const filters = [];
  let cumulative = rendered[0].dur;
  let last = '0:v';
  for (let i = 1; i < rendered.length; i++) {
    const s = rendered[i];
    const trans = s.transition;
    const dur = trans.in_duration || 0.04;
    const offset = (cumulative - dur).toFixed(3);
    const lbl = `v${String(i).padStart(2, '0')}`;
    filters.push(`[${last}][${i}:v]xfade=transition=fade:duration=${dur}:offset=${offset}[${lbl}]`);
    cumulative = cumulative + s.dur - dur;
    last = lbl;
  }
  const cmd = [
    'ffmpeg -y', inputs,
    `-filter_complex "${filters.join(';')}"`,
    `-map "[${last}]"`,
    `-t ${cumulative.toFixed(3)}`,
    `-c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p`,
    `"${out}"`,
  ].join(' ');
  console.log(`[concat] ${rendered.length} shots → ${cumulative.toFixed(2)}s`);
  execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] });
  return { path: out, dur: cumulative };
}

function mixAudio(videoPath, totalDur) {
  const out = path.join(VIDEO, 'storytree-happy.mp4');
  const cmd = [
    'ffmpeg -y',
    `-i "${videoPath}"`,
    `-i "${MUSIC}"`,
    `-filter_complex "`,
    `[1:a]volume=0.55,atrim=duration=${totalDur},afade=t=in:st=0:d=2.5,afade=t=out:st=${(totalDur - 3).toFixed(2)}:d=3[mus];`,
    `[mus]volume=1.2[aout]`,
    `"`,
    `-map 0:v -map "[aout]"`,
    `-t ${totalDur.toFixed(3)}`,
    `-c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k`,
    `"${out}"`,
  ].join(' ');
  console.log(`[audio] emotional-piano fade-in 2.5s, fade-out 3s, vol 0.55*1.2`);
  execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] });
  return out;
}

// ================================================================
// MAIN
// ================================================================

(async () => {
  const t0 = Date.now();
  console.log(`storytree-happy — "Uma Manhã, Um Cachorro, Uma Vida"`);
  console.log(`format: ${FORMAT} | duration: ${TOTAL_DURATION}s | resolution: ${W}x${H}@${FPS}`);
  console.log(`output: ${OUT}\n`);

  await genImages();
  const plan = buildAndValidate();

  console.log('=== RENDER ===');
  const rendered = plan.map((s, i) => renderShot(s, i, plan.length));
  const noAudio = concatWithXfade(rendered);
  const finalVid = mixAudio(noAudio.path, noAudio.dur);

  const meta = {
    timestamp: new Date().toISOString(),
    title: 'Uma Manhã, Um Cachorro, Uma Vida',
    output: finalVid,
    duration: noAudio.dur,
    format: FORMAT,
    resolution: `${W}x${H}@${FPS}`,
    shots: plan.length,
    music: 'emotional-piano (Freesound CC-BY-NC, AudioCoffee #721057)',
    techniques: [
      'auto image_class via storytree-classify (keyword-based, zero API)',
      'plan via storytree-shot-schema buildPlanFromImages',
      'rhythm via storytree-rhythm storytelling format',
      'motion selected by storytree-selector (image_class × role)',
      'QA via storytree-qa pre-render with auto-downgrade',
      'easing curves via storytree-presets',
      'flash_cut brightness 0.5 (no overshoot)',
    ],
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));

  fs.rmSync(TMP, { recursive: true, force: true });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDONE in ${dt}s → ${finalVid}`);
})().catch((e) => {
  console.error('\nFAIL:', e.message);
  process.exit(1);
});
