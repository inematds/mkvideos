const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { runId, runDir, manifestPath, latestPath, batchPath, imgsDir, videoPath, scriptPath } = require('../lib/output-paths');

test('runId formato ISO+hash', () => {
  const id = runId();
  assert.match(id, /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_[a-f0-9]{4}$/);
});

test('runId determinístico com data fixa', () => {
  const d = new Date('2026-05-07T14:30:00Z');
  const id1 = runId(d);
  const id2 = runId(d);
  assert.notStrictEqual(id1, id2, 'tail random deve diferir');
  assert.ok(id1.startsWith('2026-05-07T14-30-00_'));
});

test('runDir compõe template/slug/run_id', () => {
  const d = runDir('templ', 'fisio', '2026-05-07T14-30-00_a4b1');
  assert.strictEqual(d, path.join('output', 'templ', 'fisio', '2026-05-07T14-30-00_a4b1'));
});

test('manifestPath = runDir/manifest.json', () => {
  assert.strictEqual(manifestPath('templ', 'fisio', 'X'), path.join('output', 'templ', 'fisio', 'X', 'manifest.json'));
});

test('latestPath = template/slug/latest.json', () => {
  assert.strictEqual(latestPath('templ', 'fisio'), path.join('output', 'templ', 'fisio', 'latest.json'));
});

test('batchPath = template/_batches/<id>.json', () => {
  assert.strictEqual(batchPath('templ', 'B1'), path.join('output', 'templ', '_batches', 'B1.json'));
});

test('imgsDir e videoPath compõem corretamente', () => {
  assert.strictEqual(imgsDir('templ', 'fisio', 'X'), path.join('output', 'templ', 'fisio', 'X', 'imgs'));
  assert.strictEqual(videoPath('templ', 'fisio', 'X'), path.join('output', 'templ', 'fisio', 'X', 'video.mp4'));
});

test('scriptPath aponta pro resolved-script.txt', () => {
  assert.strictEqual(scriptPath('templ', 'fisio', 'X'), path.join('output', 'templ', 'fisio', 'X', 'resolved-script.txt'));
});
