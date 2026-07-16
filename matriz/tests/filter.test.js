const test = require('node:test');
const assert = require('node:assert');
const { parseFilter, applyFilter } = require('../lib/filter');

const cat = [
  { slug: 'fisio', label: 'Fisio', area: 'saude' },
  { slug: 'enf', label: 'Enf', area: 'saude' },
  { slug: 'eng', label: 'Eng', area: 'tech' }
];

test('parseFilter aceita "area:saude"', () => {
  assert.deepStrictEqual(parseFilter('area:saude'), { area: 'saude' });
});

test('parseFilter aceita "slug:fisio"', () => {
  assert.deepStrictEqual(parseFilter('slug:fisio'), { slug: 'fisio' });
});

test('parseFilter aceita múltiplos pares "area:saude,slug:fisio"', () => {
  assert.deepStrictEqual(parseFilter('area:saude,slug:fisio'), { area: 'saude', slug: 'fisio' });
});

test('parseFilter vazio retorna {}', () => {
  assert.deepStrictEqual(parseFilter(''), {});
  assert.deepStrictEqual(parseFilter(undefined), {});
});

test('applyFilter por area', () => {
  const out = applyFilter(cat, { area: 'saude' });
  assert.strictEqual(out.length, 2);
});

test('applyFilter por slug', () => {
  const out = applyFilter(cat, { slug: 'fisio' });
  assert.strictEqual(out.length, 1);
});

test('applyFilter vazio retorna todos', () => {
  assert.strictEqual(applyFilter(cat, {}).length, 3);
});

test('applyFilter respeita limit', () => {
  assert.strictEqual(applyFilter(cat, {}, 2).length, 2);
});

test('applyFilter por área inexistente retorna []', () => {
  assert.strictEqual(applyFilter(cat, { area: 'inexistente' }).length, 0);
});
