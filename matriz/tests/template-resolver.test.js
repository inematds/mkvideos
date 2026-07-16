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

const { resolveScriptBlockAsync, resolveHookBlock } = require('../lib/template-resolver');

test('resolveScriptBlockAsync rewrite chama LLM com instruction interpolada', async () => {
  const calls = [];
  const fakeLLM = async ({ prompt }) => { calls.push(prompt); return { text: 'reescrito', tokens_in: 10, tokens_out: 3, duration_ms: 5 }; };
  const block = { type: 'rewrite', role: 'explanation', instruction: 'fala sobre {classic_task} para {profissao_label}' };
  const out = await resolveScriptBlockAsync(block, profile, {}, {
    llmFn: fakeLLM,
    llmCfg: { provider: 'openrouter', model: 'm', max_tokens: 100 },
    temperature: 0.7,
    seed: 1,
  });
  assert.strictEqual(out.text, 'reescrito');
  assert.strictEqual(out.role, 'explanation');
  assert.strictEqual(out.type, 'rewrite');
  assert.match(calls[0], /manual mobilization/);
  assert.match(calls[0], /FISIOTERAPEUTA/);
  assert.ok(out._llm, 'esperava metadata _llm preservada');
  assert.strictEqual(out._llm.tokens_in, 10);
});

test('resolveScriptBlockAsync fixed delega para sync', async () => {
  const out = await resolveScriptBlockAsync({ type: 'fixed', role: 'hook', text: 'Olá {profissao_label}' }, profile, {}, {});
  assert.strictEqual(out.text, 'Olá FISIOTERAPEUTA');
});

test('resolveScriptBlockAsync slot delega para sync', async () => {
  const out = await resolveScriptBlockAsync({ type: 'slot', role: 'context', template: 'faz {classic_task}' }, profile, {}, {});
  assert.strictEqual(out.text, 'faz manual mobilization');
});

test('resolveScriptBlockAsync hook retorna placeholder', async () => {
  const out = await resolveScriptBlockAsync({ type: 'hook', role: 'closing' }, profile, {}, {});
  assert.strictEqual(out.type, 'hook');
  assert.strictEqual(out.role, 'closing');
  assert.strictEqual(out._placeholder, true);
});

test('resolveHookBlock policy=default usa hook.text rewrite', async () => {
  const fakeLLM = async () => ({ text: 'hook gerado', tokens_in: 1, tokens_out: 1, duration_ms: 1 });
  const tmpl = { hook: { policy: 'default', position: 'outro', text: { type: 'rewrite', instruction: 'frase para {profissao_label}' } } };
  const out = await resolveHookBlock(tmpl, profile, {}, { llmFn: fakeLLM, llmCfg: { provider: 'openrouter', model: 'm' }, temperature: 0.7, seed: 1 });
  assert.strictEqual(out.text, 'hook gerado');
  assert.strictEqual(out.policy, 'default');
  assert.strictEqual(out.position, 'outro');
});

test('resolveHookBlock policy=off retorna null', async () => {
  const tmpl = { hook: { policy: 'off', position: 'outro' } };
  const out = await resolveHookBlock(tmpl, profile, {}, {});
  assert.strictEqual(out, null);
});

test('resolveHookBlock policy=override usa override.text/instruction', async () => {
  const fakeLLM = async ({ prompt }) => ({ text: `OV:${prompt}`, tokens_in: 1, tokens_out: 1, duration_ms: 1 });
  const tmpl = { hook: { policy: 'override', position: 'outro', text: { type: 'rewrite', instruction: 'orig' } } };
  const override = { instruction: 'frase nova para {profissao_label}', type: 'rewrite' };
  const out = await resolveHookBlock(tmpl, profile, {}, { llmFn: fakeLLM, llmCfg: { provider: 'openrouter', model: 'm' }, temperature: 0.7, override });
  assert.match(out.text, /OV:.*FISIOTERAPEUTA/);
});

test('resolveHookBlock policy=default com text fixed', async () => {
  const tmpl = { hook: { policy: 'default', position: 'outro', text: { type: 'fixed', text: 'Olá {profissao_label}' } } };
  const out = await resolveHookBlock(tmpl, profile, {}, {});
  assert.strictEqual(out.text, 'Olá FISIOTERAPEUTA');
});

test('resolveHookBlock policy=default com text slot', async () => {
  const tmpl = { hook: { policy: 'default', position: 'outro', text: { type: 'slot', template: '{character} eh demais' } } };
  const out = await resolveHookBlock(tmpl, profile, {}, {});
  assert.strictEqual(out.text, 'Brazilian woman ... eh demais');
});
