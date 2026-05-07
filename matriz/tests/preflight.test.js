const test = require('node:test');
const assert = require('node:assert');
const { collectSlots, checkSlotIntegrity, estimateBudget } = require('../lib/preflight');

test('collectSlots extrai todos os slots usados no template', () => {
  const tmpl = {
    script: [
      { type: 'fixed', text: 'Você é {profissao_label}.' },
      { type: 'slot', template: '{classic_task} no {workplace}' },
      { type: 'rewrite', instruction: 'fale sobre {ai_application} para {profissao_label}' },
    ],
    visual: { shots: [{ prompt: { type: 'slot', template: '{character} usa {ai_daily_tool}' } }] },
    hook: { text: { type: 'rewrite', instruction: 'frase para {profissao_label}' } },
  };
  const s = collectSlots(tmpl);
  assert.ok(s.has('classic_task'));
  assert.ok(s.has('workplace'));
  assert.ok(s.has('ai_application'));
  assert.ok(s.has('character'));
  assert.ok(s.has('ai_daily_tool'));
  assert.ok(!s.has('profissao_label'), 'built-in não vai pra slots');
  assert.ok(!s.has('base_style'), 'built-in não vai pra slots');
});

test('collectSlots ignora hook ausente', () => {
  const tmpl = {
    script: [{ type: 'fixed', text: '{classic_task}' }],
    visual: { shots: [] },
  };
  const s = collectSlots(tmpl);
  assert.ok(s.has('classic_task'));
});

test('checkSlotIntegrity reporta profissões com slot faltante', () => {
  const slots = new Set(['classic_task', 'foo_inexistente']);
  const cat = [
    { slug: 'a', props: { classic_task: 'x' } },
    { slug: 'b', props: { classic_task: 'y', foo_inexistente: 'z' } }
  ];
  const r = checkSlotIntegrity(slots, cat);
  assert.strictEqual(r.complete.length, 1);
  assert.strictEqual(r.missing.length, 1);
  assert.strictEqual(r.missing[0].slug, 'a');
  assert.deepStrictEqual(r.missing[0].missing_slots, ['foo_inexistente']);
});

test('checkSlotIntegrity todos completos', () => {
  const slots = new Set(['a']);
  const cat = [{ slug: 'x', props: { a: 1 } }, { slug: 'y', props: { a: 2 } }];
  const r = checkSlotIntegrity(slots, cat);
  assert.strictEqual(r.complete.length, 2);
  assert.strictEqual(r.missing.length, 0);
});

test('estimateBudget calcula videos, llmCalls, tokens, images', () => {
  const tmpl = {
    script: [
      { type: 'fixed' }, { type: 'slot' }, { type: 'rewrite' }, { type: 'rewrite' }, { type: 'hook' },
    ],
    visual: { shots: [{ role: 'a' }, { role: 'b' }, { role: 'c' }] },
    hook: { policy: 'default', text: { type: 'rewrite' } },
    llm: { max_tokens: 200 },
  };
  const subset = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }];
  const b = estimateBudget(tmpl, subset);
  assert.strictEqual(b.videos, 3);
  assert.strictEqual(b.llmCalls, 3 * (2 + 1)); // 2 rewrites + 1 hook rewrite
  assert.strictEqual(b.tokensEst, 9 * 200);
  assert.strictEqual(b.images, 3 * 3);
});

test('estimateBudget hook off não conta hook como llm call', () => {
  const tmpl = {
    script: [{ type: 'rewrite' }],
    visual: { shots: [{}] },
    hook: { policy: 'off' },
    llm: { max_tokens: 100 },
  };
  const b = estimateBudget(tmpl, [{ slug: 'a' }]);
  assert.strictEqual(b.llmCalls, 1); // só o rewrite, sem hook
});
