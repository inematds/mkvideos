const test = require('node:test');
const assert = require('node:assert');
const { pickSample } = require('../lib/gates');

test('pickSample retorna N elementos diversificados por area', () => {
  const cat = [
    { slug: 'a1', area: 'saude' }, { slug: 'a2', area: 'saude' },
    { slug: 'b1', area: 'tech' }, { slug: 'b2', area: 'tech' },
    { slug: 'c1', area: 'edu' }, { slug: 'd1', area: 'lei' }
  ];
  const s = pickSample(cat, 4, 42);
  assert.strictEqual(s.length, 4);
  const areas = new Set(s.map((p) => p.area));
  assert.ok(areas.size >= 3, `esperava >=3 areas, peguei ${areas.size}`);
});

test('pickSample determinístico por seed', () => {
  const cat = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }, { slug: 'd' }];
  const s1 = pickSample(cat, 2, 1);
  const s2 = pickSample(cat, 2, 1);
  assert.deepStrictEqual(s1.map((p) => p.slug), s2.map((p) => p.slug));
});

test('pickSample N maior que catalog retorna catalog inteiro', () => {
  const cat = [{ slug: 'a' }, { slug: 'b' }];
  const s = pickSample(cat, 5, 42);
  assert.strictEqual(s.length, 2);
});

test('pickSample com catalog vazio retorna []', () => {
  const s = pickSample([], 3, 42);
  assert.deepStrictEqual(s, []);
});

test('pickSample sem area usa _default', () => {
  const cat = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }];
  const s = pickSample(cat, 2, 42);
  assert.strictEqual(s.length, 2);
});
