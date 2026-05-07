const test = require('node:test');
const assert = require('node:assert');
const { resolveSeed, deriveBlockSeed } = require('../lib/seed-strategy');

test('resolveSeed determinístico por slug com strategy=profissao_hash', () => {
  const a = resolveSeed({ strategy: 'profissao_hash' }, 'fisioterapeuta', false);
  const b = resolveSeed({ strategy: 'profissao_hash' }, 'fisioterapeuta', false);
  assert.strictEqual(a, b);
});

test('resolveSeed muda quando reseed=true', () => {
  const a = resolveSeed({ strategy: 'profissao_hash' }, 'fisioterapeuta', false);
  const b = resolveSeed({ strategy: 'profissao_hash' }, 'fisioterapeuta', true);
  assert.notStrictEqual(a, b);
});

test('deriveBlockSeed gera seeds distintas por role', () => {
  const base = 100000;
  assert.notStrictEqual(deriveBlockSeed(base, 'hook'), deriveBlockSeed(base, 'context'));
});

test('resolveSeed com slugs diferentes gera valores diferentes', () => {
  const a = resolveSeed({ strategy: 'profissao_hash' }, 'fisioterapeuta', false);
  const b = resolveSeed({ strategy: 'profissao_hash' }, 'enfermeira', false);
  assert.notStrictEqual(a, b);
});

test('resolveSeed retorna uint32 válido', () => {
  const v = resolveSeed({ strategy: 'profissao_hash' }, 'fisioterapeuta', false);
  assert.ok(Number.isInteger(v));
  assert.ok(v >= 0 && v <= 0xFFFFFFFF);
});
