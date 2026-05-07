const test = require('node:test');
const assert = require('node:assert');
const { resolveText, resolveScriptBlock, resolvePromptBlock } = require('../lib/template-resolver');

const profile = {
  slug: 'fisioterapeuta',
  label: 'FISIOTERAPEUTA',
  props: {
    classic_task: 'manual mobilization',
    character: 'Brazilian woman ...',
    workplace: 'physiotherapy clinic',
    ai_application: 'AI rehab plan',
    ai_daily_tool: 'AI pose tablet'
  }
};

test('resolveText substitui {profissao_label}', () => {
  assert.strictEqual(resolveText('Você é {profissao_label}.', profile), 'Você é FISIOTERAPEUTA.');
});

test('resolveText substitui slot do props', () => {
  assert.strictEqual(resolveText('faz {classic_task}.', profile), 'faz manual mobilization.');
});

test('resolveText substitui múltiplos slots', () => {
  assert.strictEqual(resolveText('{character} no {workplace}.', profile), 'Brazilian woman ... no physiotherapy clinic.');
});

test('resolveText aceita extras (ex: base_style)', () => {
  assert.strictEqual(resolveText('{workplace}. {base_style}', profile, { base_style: 'cinematic' }), 'physiotherapy clinic. cinematic');
});

test('resolveText falha clara se slot ausente', () => {
  assert.throws(() => resolveText('{slot_inexistente}', profile), /slot.*slot_inexistente/);
});

test('resolveScriptBlock fixed retorna text com substituição', () => {
  const out = resolveScriptBlock({ type: 'fixed', role: 'hook', text: 'Você é {profissao_label}.' }, profile);
  assert.deepStrictEqual(out, { type: 'fixed', role: 'hook', text: 'Você é FISIOTERAPEUTA.' });
});

test('resolveScriptBlock slot resolve template', () => {
  const out = resolveScriptBlock({ type: 'slot', role: 'context', template: 'Hoje, você gasta horas com {classic_task}.' }, profile);
  assert.strictEqual(out.text, 'Hoje, você gasta horas com manual mobilization.');
  assert.strictEqual(out.role, 'context');
});

test('resolveScriptBlock rewrite lança erro nesta fase', () => {
  assert.throws(() => resolveScriptBlock({ type: 'rewrite', role: 'x', instruction: 'i' }, profile), /rewrite|não suportado/i);
});

test('resolvePromptBlock fixed', () => {
  const out = resolvePromptBlock({ type: 'fixed', text: 'Brazilian pro' }, profile, { base_style: 'cinematic' });
  assert.strictEqual(out, 'Brazilian pro');
});

test('resolvePromptBlock slot com base_style', () => {
  const out = resolvePromptBlock({ type: 'slot', template: '{character} no {workplace}. {base_style}' }, profile, { base_style: 'cinematic' });
  assert.strictEqual(out, 'Brazilian woman ... no physiotherapy clinic. cinematic');
});
