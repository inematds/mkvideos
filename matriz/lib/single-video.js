const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { resolveScriptBlock, resolvePromptBlock } = require('./template-resolver');
const { resolveSeed, deriveBlockSeed } = require('./seed-strategy');
const { runId, runDir, manifestPath, latestPath } = require('./output-paths');
const { initManifest, updateManifest, writeLatest, readManifest } = require('./manifest-writer');

const { generateImage } = require('../../pipeline/generate-image-inemaimg');
const { buildPlanFromImages } = require('../../lib/storytree-shot-schema');
const { validateShotPlan } = require('../../lib/storytree-qa');
const { buildShotVF } = require('../../lib/storytree-presets');

const ASPECT_TO_SIZE = {
  '9:16': { W: 1080, H: 1920 },
  '16:9': { W: 1920, H: 1080 },
  '1:1':  { W: 1080, H: 1080 },
  '4:3':  { W: 1440, H: 1080 },
  '3:4':  { W: 1080, H: 1440 },
};

const DEFAULT_FPS = 25;

async function generateSingle({ template, profile, batchId, reseed = false }) {
  const rid = runId();
  const tid = template.meta.id;
  const slug = profile.slug;
  const dir = runDir(tid, slug, rid);
  fs.mkdirSync(path.join(dir, 'imgs'), { recursive: true });

  const seedValue = resolveSeed(template.variation, slug, reseed);
  const mp = manifestPath(tid, slug, rid);

  initManifest(mp, {
    run_id: rid,
    batch_id: batchId,
    template: {
      id: tid,
      version: template.meta.version,
      file_path: template._meta.file_path,
      file_sha256: template._meta.file_sha256,
    },
    profissao: {
      slug,
      label: profile.label,
      catalog_file: template.target.catalog,
    },
    gate: { mode: 'none', selected_for_sample: false },
    seed: { strategy: template.variation.seed_strategy, value: seedValue, reseed },
  });

  const tStart = Date.now();
  updateManifest(mp, { status: 'resolving' });

  // 1. Resolve script (fixed + slot apenas; rewrite/hook ficam pra Phase 5)
  const extras = { base_style: template.visual.base_style || '' };
  const resolvedScript = template.script
    .filter((b) => b.type !== 'rewrite' && b.type !== 'hook')
    .map((b) => resolveScriptBlock(b, profile, extras));

  // 2. Resolve visual prompts
  const resolvedShots = template.visual.shots.map((s, i) => ({
    role: s.role,
    prompt: resolvePromptBlock(s.prompt, profile, extras),
    model: template.visual.model,
    seed_image: deriveBlockSeed(seedValue, `visual:${s.role}:${i}`),
    image_path: path.join('imgs', `shot_${String(i + 1).padStart(2, '0')}.png`),
  }));

  fs.writeFileSync(
    path.join(dir, 'resolved-script.txt'),
    resolvedScript.map((b) => `[${b.role}] ${b.text}`).join('\n')
  );

  updateManifest(mp, {
    status: 'resolved',
    resolved: {
      script: resolvedScript,
      visual: { shots: resolvedShots },
      format: template.format,
    },
  });

  // 3. Image gen
  updateManifest(mp, { status: 'image_generating' });
  const tImg = Date.now();
  for (const shot of resolvedShots) {
    const out = path.join(dir, shot.image_path);
    if (fs.existsSync(out) && fs.statSync(out).size > 50000) continue;
    await generateImage({
      outputPath: out,
      prompt: shot.prompt,
      model: template.visual.model,
      ratio: template.format.aspect,
      seed: shot.seed_image,
      quality: template.visual.quality || 'fast',
    });
  }
  const imgMs = Date.now() - tImg;

  // 4. Build shot plan via storytree
  // buildPlanFromImages expects: img.path, img.image_class, img.id, img.resolution
  const images = resolvedShots.map((s) => ({
    path: path.join(dir, s.image_path),
    role: s.role,
    image_class: 'face', // simplificação inicial — storytree-classify entra em fase posterior
  }));
  const plan = buildPlanFromImages(images, template.format.key, template.format.duration_seconds);

  // validateShotPlan takes the shots array directly
  const qa = validateShotPlan(plan);
  if (qa.errors && qa.errors.length) {
    updateManifest(mp, {
      status: 'failed',
      error: { stage: 'qa', message: qa.errors.join('; ') },
      qa,
    });
    throw new Error(`storytree QA: ${qa.errors.join('; ')}`);
  }

  // 5. Render: per-shot segment + concat
  const cur = readManifest(mp);
  updateManifest(mp, {
    status: 'rendering',
    resolved: { ...cur.resolved, shot_plan: plan },
  });

  const tRender = Date.now();
  const dim = ASPECT_TO_SIZE[template.format.aspect] || ASPECT_TO_SIZE['9:16'];
  const FPS = DEFAULT_FPS;
  const PRE_W = Math.round(dim.W * 1.5);
  const PRE_H = Math.round(dim.H * 1.5);

  const segs = [];
  plan.forEach((shot, i) => {
    const segOut = path.join(dir, `_seg_${i}.mp4`);
    const vf = buildShotVF(shot, { W: dim.W, H: dim.H, FPS, PRE_W, PRE_H });
    // shot.image_path is the image file for this shot
    const imgFile = shot.image_path;
    const cmd = `ffmpeg -y -loop 1 -i "${imgFile}" -t ${shot.timing.duration} -vf "${vf}" -c:v libx264 -pix_fmt yuv420p -preset fast "${segOut}"`;
    execSync(cmd, { stdio: 'pipe' });
    segs.push(segOut);
  });
  const concatList = path.join(dir, '_concat.txt');
  fs.writeFileSync(concatList, segs.map((s) => `file '${s}'`).join('\n'));
  const finalOut = path.join(dir, 'video.mp4');
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${finalOut}"`, { stdio: 'pipe' });
  segs.forEach((s) => fs.unlinkSync(s));
  fs.unlinkSync(concatList);
  const renderMs = Date.now() - tRender;

  const stat = fs.statSync(finalOut);
  updateManifest(mp, {
    status: 'done',
    timings: { image_gen_ms: imgMs, render_ms: renderMs, total_ms: Date.now() - tStart },
    output: {
      video_path: 'video.mp4',
      imgs_dir: 'imgs',
      script_path: 'resolved-script.txt',
      video_size_bytes: stat.size,
      video_duration_seconds: template.format.duration_seconds,
    },
  });

  writeLatest(latestPath(tid, slug), rid);
  return { manifest: mp, video: finalOut };
}

module.exports = { generateSingle };
