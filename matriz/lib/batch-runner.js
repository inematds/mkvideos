'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { generateSingle } = require('./single-video');
const { runWithLimit } = require('./concurrency');
const { batchPath, runId } = require('./output-paths');

const DEFAULT_CONCURRENCY = 4;

async function runBatch({ template, subset, gateMode = 'none', reseed = false, concurrency = DEFAULT_CONCURRENCY, onProgress }) {
  const batchId = runId();
  const summary = {
    batch_id: batchId,
    template: { id: template.meta.id, version: template.meta.version },
    gate_mode: gateMode,
    started_at: new Date().toISOString(),
    ended_at: null,
    totals: { planned: subset.length, done: 0, failed: 0, skipped: 0 },
    videos: subset.map((p) => ({ slug: p.slug, status: 'pending', manifest: null, error_stage: null, error_message: null })),
  };

  const summaryFile = batchPath(template.meta.id, batchId);
  fs.mkdirSync(path.dirname(summaryFile), { recursive: true });
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

  const tasks = subset.map((profile, idx) => async () => {
    if (onProgress) onProgress({ idx, total: subset.length, slug: profile.slug, status: 'starting' });
    try {
      const r = await generateSingle({ template, profile, batchId, reseed });
      summary.videos[idx].status = 'done';
      summary.videos[idx].manifest = r.manifest;
      summary.totals.done += 1;
      if (onProgress) onProgress({ idx, total: subset.length, slug: profile.slug, status: 'done' });
      return r;
    } catch (e) {
      summary.videos[idx].status = 'failed';
      summary.videos[idx].error_stage = e.stage || 'unknown';
      summary.videos[idx].error_message = e.message;
      summary.totals.failed += 1;
      if (onProgress) onProgress({ idx, total: subset.length, slug: profile.slug, status: 'failed', error: e.message });
      return null;
    } finally {
      fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    }
  });

  await runWithLimit(tasks, concurrency);
  summary.ended_at = new Date().toISOString();
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  return { batchId, summary, summaryFile };
}

module.exports = { runBatch };
