'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { withRetry } = require('./error-handler');
const { generateImage } = require('../../pipeline/generate-image-inemaimg');
const { buildShotVF } = require('../../lib/storytree-presets');
const { runId, runDir, manifestPath, latestPath } = require('./output-paths');
const { initManifest, updateManifest, writeLatest } = require('./manifest-writer');

const ASPECT_TO_SIZE = {
  '9:16': { W: 1080, H: 1920 },
  '16:9': { W: 1920, H: 1080 },
  '1:1':  { W: 1080, H: 1080 },
  '4:3':  { W: 1440, H: 1080 },
  '3:4':  { W: 1080, H: 1440 },
};
const DEFAULT_FPS = 25;

async function replayManifest(srcManifestPath) {
  const src = JSON.parse(fs.readFileSync(srcManifestPath, 'utf8'));
  if (!src.resolved) throw new Error('manifest sem resolved.* — não é replay-able');

  const tid = src.template.id;
  const slug = src.profissao.slug;
  const newRid = runId();
  const dir = runDir(tid, slug, newRid);
  fs.mkdirSync(path.join(dir, 'imgs'), { recursive: true });
  const mp = manifestPath(tid, slug, newRid);

  initManifest(mp, {
    run_id: newRid,
    batch_id: 'replay',
    template: src.template,
    profissao: src.profissao,
    seed: src.seed,
    gate: { mode: 'replay', selected_for_sample: false },
    resolved: src.resolved,
    llm_calls: src.llm_calls || [],
  });

  updateManifest(mp, { status: 'imaging' });

  // quality: default high for replays unless already set
  if (process.env.INEMAIMG_QUALITY === undefined) {
    process.env.INEMAIMG_QUALITY = 'high';
  }

  for (const shot of src.resolved.visual.shots) {
    const out = path.join(dir, shot.image_path);
    if (fs.existsSync(out) && fs.statSync(out).size > 50000) continue;
    await withRetry(() => generateImage(out, shot.prompt, src.resolved.visual.model || src.template.visual_model, src.resolved.format.aspect), { attempts: 3, baseMs: 1000 });
  }

  updateManifest(mp, { status: 'rendering' });

  // render usando shot_plan gravado
  const plan = src.resolved.shot_plan;
  if (!plan || !Array.isArray(plan)) throw new Error('shot_plan ausente ou inválido no manifest');

  const dim = ASPECT_TO_SIZE[src.resolved.format.aspect] || ASPECT_TO_SIZE['9:16'];
  const FPS = DEFAULT_FPS;
  const PRE_W = Math.round(dim.W * 1.5);
  const PRE_H = Math.round(dim.H * 1.5);

  const segs = [];
  plan.forEach((shot, i) => {
    const segOut = path.join(dir, `_seg_${i}.mp4`);
    const vf = buildShotVF(shot, { W: dim.W, H: dim.H, FPS, PRE_W, PRE_H });
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

  const stat = fs.statSync(finalOut);
  updateManifest(mp, {
    status: 'done',
    output: {
      video_path: 'video.mp4',
      imgs_dir: 'imgs',
      script_path: 'resolved-script.txt',
      video_size_bytes: stat.size,
      video_duration_seconds: src.resolved.format.duration_seconds,
    },
  });
  writeLatest(latestPath(tid, slug), newRid);
  return finalOut;
}

module.exports = { replayManifest };
