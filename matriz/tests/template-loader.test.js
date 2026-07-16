const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadTemplate } = require('../lib/template-loader');

test('loadTemplate carrega YAML válido e retorna objeto', () => {
  const t = loadTemplate(path.join(__dirname, '../templates/approved/example-como-usar-ia-vanguarda.yml'));
  assert.strictEqual(t.meta.id, 'como-usar-ia-vanguarda');
  assert.strictEqual(t.format.key, 'short_reel');
  assert.strictEqual(t.script.length, 4);
});

test('loadTemplate calcula sha256 do arquivo', () => {
  const t = loadTemplate(path.join(__dirname, '../templates/approved/example-como-usar-ia-vanguarda.yml'));
  assert.match(t._meta.file_sha256, /^[a-f0-9]{64}$/);
});

test('loadTemplate falha com erro claro em arquivo inexistente', () => {
  assert.throws(() => loadTemplate('/nonexistent.yml'), /ENOENT|not found|no such file/i);
});

test('loadTemplate falha em template que viola schema', () => {
  const fs = require('node:fs');
  const tmp = path.join(__dirname, '_tmp_invalid.yml');
  fs.writeFileSync(tmp, 'meta:\n  id: x\n');
  try {
    assert.throws(() => loadTemplate(tmp), /schema|required/i);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('loadTemplate carrega defaults globais em _defaults', () => {
  const t = loadTemplate(path.join(__dirname, '../templates/approved/example-como-usar-ia-vanguarda.yml'));
  assert.ok(t._defaults, 'esperava _defaults presente');
  assert.strictEqual(t._defaults.captions, true);
  assert.strictEqual(t._defaults.codec.video, 'libx264');
});
