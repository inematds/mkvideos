'use strict';
const fs = require('node:fs');
const { batchPath } = require('./output-paths');

function loadBatchSummary(templateId, batchId) {
  const p = batchPath(templateId, batchId);
  if (!fs.existsSync(p)) throw new Error(`batch summary não encontrado: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function failedSlugs(summary) {
  return summary.videos
    .filter((v) => v.status === 'failed' || v.status === 'pending')
    .map((v) => v.slug);
}

module.exports = { loadBatchSummary, failedSlugs };
