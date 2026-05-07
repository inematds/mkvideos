const fs = require('node:fs');
const path = require('node:path');

function initManifest(filePath, base) {
  const now = new Date().toISOString();
  const m = {
    manifest_version: 1,
    status: 'pending',
    error: null,
    llm_calls: [],
    timings: {},
    qa: { storytree_qa_warnings: [], storytree_qa_errors: [] },
    resolved: null,
    output: null,
    created_at: now,
    updated_at: now,
    ...base,
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(m, null, 2));
  return m;
}

function readManifest(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function updateManifest(filePath, patch) {
  const cur = readManifest(filePath);
  const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2));
  return next;
}

function writeLatest(latestFilePath, runId) {
  fs.mkdirSync(path.dirname(latestFilePath), { recursive: true });
  fs.writeFileSync(latestFilePath, JSON.stringify({ run_id: runId, updated_at: new Date().toISOString() }, null, 2));
}

module.exports = { initManifest, readManifest, updateManifest, writeLatest };
