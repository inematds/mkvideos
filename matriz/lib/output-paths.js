const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = 'output';

function runId(d = new Date()) {
  const iso = d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tail = crypto.randomBytes(2).toString('hex');
  return `${iso}_${tail}`;
}

function runDir(templateId, slug, rid) {
  return path.join(ROOT, templateId, slug, rid);
}

function manifestPath(templateId, slug, rid) {
  return path.join(runDir(templateId, slug, rid), 'manifest.json');
}

function latestPath(templateId, slug) {
  return path.join(ROOT, templateId, slug, 'latest.json');
}

function batchPath(templateId, batchId) {
  return path.join(ROOT, templateId, '_batches', `${batchId}.json`);
}

function imgsDir(templateId, slug, rid) {
  return path.join(runDir(templateId, slug, rid), 'imgs');
}

function videoPath(templateId, slug, rid) {
  return path.join(runDir(templateId, slug, rid), 'video.mp4');
}

function scriptPath(templateId, slug, rid) {
  return path.join(runDir(templateId, slug, rid), 'resolved-script.txt');
}

module.exports = { runId, runDir, manifestPath, latestPath, batchPath, imgsDir, videoPath, scriptPath };
