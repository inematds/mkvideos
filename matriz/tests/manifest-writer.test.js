const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { initManifest, updateManifest, writeLatest, readManifest } = require('../lib/manifest-writer');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'matriz-test-'));

test('initManifest cria arquivo com status=pending', () => {
  const p = path.join(TMP, 'manifest.json');
  initManifest(p, {
    run_id: 'R1', batch_id: 'B1',
    template: { id: 't', version: 1 },
    profissao: { slug: 'fisio', label: 'Fisio' },
    seed: { value: 1, strategy: 'profissao_hash', reseed: false }
  });
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(m.status, 'pending');
  assert.strictEqual(m.manifest_version, 1);
  assert.ok(m.created_at);
  assert.strictEqual(m.run_id, 'R1');
  assert.strictEqual(m.batch_id, 'B1');
});

test('initManifest cria diretório pai se não existe', () => {
  const p = path.join(TMP, 'deep/nested/dir/manifest.json');
  initManifest(p, { run_id: 'R2' });
  assert.ok(fs.existsSync(p));
});

test('updateManifest mescla campos e atualiza updated_at', async () => {
  const p = path.join(TMP, 'manifest.json');
  const before = readManifest(p).updated_at;
  await new Promise((r) => setTimeout(r, 10));
  updateManifest(p, { status: 'resolving' });
  const after = readManifest(p);
  assert.strictEqual(after.status, 'resolving');
  assert.notStrictEqual(after.updated_at, before);
  assert.strictEqual(after.run_id, 'R1', 'campos anteriores preservados');
});

test('updateManifest preserva llm_calls e timings existentes', () => {
  const p = path.join(TMP, 'manifest.json');
  updateManifest(p, { llm_calls: [{ model: 'x', tokens_in: 10 }] });
  updateManifest(p, { status: 'done' });
  const m = readManifest(p);
  assert.strictEqual(m.llm_calls.length, 1);
  assert.strictEqual(m.status, 'done');
});

test('writeLatest escreve apontador pro run_id', () => {
  const p = path.join(TMP, 'latest.json');
  writeLatest(p, 'R1');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(j.run_id, 'R1');
  assert.ok(j.updated_at);
});
