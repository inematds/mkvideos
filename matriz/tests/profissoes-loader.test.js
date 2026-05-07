const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadProfissoes } = require('../lib/profissoes-loader');

test('loadProfissoes carrega catálogo do mkvideos', () => {
  const cat = loadProfissoes(path.join(__dirname, '../../config/profissoes-30.js'));
  assert.ok(Array.isArray(cat));
  assert.ok(cat.length >= 10);
  const fisio = cat.find((p) => p.slug === 'fisioterapeuta');
  assert.ok(fisio, 'esperava encontrar fisioterapeuta');
  assert.ok(fisio.props);
  assert.ok(fisio.props.classic_task);
});

test('loadProfissoes resolve path relativo do baseDir', () => {
  const cat = loadProfissoes('../../../config/profissoes-30.js', path.join(__dirname, '../templates/approved'));
  assert.ok(cat.length >= 10);
});

test('loadProfissoes falha em catálogo inexistente', () => {
  assert.throws(() => loadProfissoes('/nonexistent.js'), /Cannot find module|MODULE_NOT_FOUND/);
});
