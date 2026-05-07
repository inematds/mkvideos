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

  const dir = path.dirname(summaryFile);
  const stdoutLogPath = path.join(dir, `${batchId}_stdout.log`);
  const errorsLogPath = path.join(dir, `${batchId}_errors.log`);
  const stdoutLog = fs.createWriteStream(stdoutLogPath, { flags: 'a' });
  const errorsLog = fs.createWriteStream(errorsLogPath, { flags: 'a' });

  function logLine(stream, ...parts) {
    stream.write(`[${new Date().toISOString()}] ${parts.join(' ')}\n`);
  }

  const tasks = subset.map((profile, idx) => async () => {
    if (onProgress) onProgress({ idx, total: subset.length, slug: profile.slug, status: 'starting' });
    try {
      const r = await generateSingle({ template, profile, batchId, reseed });
      summary.videos[idx].status = 'done';
      summary.videos[idx].manifest = r.manifest;
      summary.totals.done += 1;
      if (onProgress) onProgress({ idx, total: subset.length, slug: profile.slug, status: 'done' });
      logLine(stdoutLog, `[${idx + 1}/${subset.length}]`, profile.slug, 'done');
      return r;
    } catch (e) {
      summary.videos[idx].status = 'failed';
      summary.videos[idx].error_stage = e.stage || 'unknown';
      summary.videos[idx].error_message = e.message;
      summary.totals.failed += 1;
      if (onProgress) onProgress({ idx, total: subset.length, slug: profile.slug, status: 'failed', error: e.message });
      logLine(stdoutLog, `[${idx + 1}/${subset.length}]`, profile.slug, 'failed', e.message);
      logLine(errorsLog, profile.slug, '|', e.stage || 'unknown', '|', e.message);
      return null;
    } finally {
      fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    }
  });

  await runWithLimit(tasks, concurrency);
  summary.ended_at = new Date().toISOString();
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

  // Agregar llm_calls dos manifests done
  const usage = { total_tokens_in: 0, total_tokens_out: 0, calls: 0, by_model: {} };
  for (const v of summary.videos) {
    if (v.status !== 'done' || !v.manifest) continue;
    try {
      const m = JSON.parse(fs.readFileSync(v.manifest, 'utf8'));
      for (const c of (m.llm_calls || [])) {
        usage.calls += 1;
        usage.total_tokens_in += c.tokens_in || 0;
        usage.total_tokens_out += c.tokens_out || 0;
        usage.by_model[c.model] = (usage.by_model[c.model] || 0) + 1;
      }
    } catch (e) {
      // skip se manifest não existir ou for inválido
    }
  }
  fs.writeFileSync(path.join(dir, `${batchId}_llm-usage.json`), JSON.stringify(usage, null, 2));
  stdoutLog.end();
  errorsLog.end();

  return { batchId, summary, summaryFile };
}

module.exports = { runBatch };
