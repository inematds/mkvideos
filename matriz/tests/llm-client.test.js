const test = require('node:test');
const assert = require('node:assert');
const { callLLM } = require('../lib/llm-client');

test('callLLM monta payload OpenRouter e parseia resposta', async () => {
  const orig = global.fetch;
  let captured;
  global.fetch = async (url, opts) => {
    captured = { url, opts };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'resposta da IA' } }], usage: { prompt_tokens: 12, completion_tokens: 5 } }),
    };
  };
  try {
    const r = await callLLM({
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.6',
      prompt: 'oi',
      temperature: 0.5,
      max_tokens: 100,
      apiKey: 'k',
    });
    assert.strictEqual(r.text, 'resposta da IA');
    assert.strictEqual(r.tokens_in, 12);
    assert.strictEqual(r.tokens_out, 5);
    assert.ok(captured.url.includes('openrouter'));
    assert.strictEqual(captured.opts.method, 'POST');
    const body = JSON.parse(captured.opts.body);
    assert.strictEqual(body.model, 'anthropic/claude-sonnet-4.6');
    assert.strictEqual(body.messages[0].content, 'oi');
    assert.strictEqual(body.temperature, 0.5);
    assert.strictEqual(body.max_tokens, 100);
  } finally {
    global.fetch = orig;
  }
});

test('callLLM com seed inclui no payload', async () => {
  const orig = global.fetch;
  let body;
  global.fetch = async (url, opts) => {
    body = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    await callLLM({ provider: 'openrouter', model: 'm', prompt: 'p', apiKey: 'k', seed: 42 });
    assert.strictEqual(body.seed, 42);
  } finally {
    global.fetch = orig;
  }
});

test('callLLM sem seed NÃO inclui seed no payload', async () => {
  const orig = global.fetch;
  let body;
  global.fetch = async (url, opts) => {
    body = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    await callLLM({ provider: 'openrouter', model: 'm', prompt: 'p', apiKey: 'k' });
    assert.ok(!('seed' in body));
  } finally {
    global.fetch = orig;
  }
});

test('callLLM com HTTP 4xx lança erro com body trecho', async () => {
  const orig = global.fetch;
  global.fetch = async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' });
  try {
    await assert.rejects(
      callLLM({ provider: 'openrouter', model: 'm', prompt: 'p', apiKey: 'bad' }),
      /401|Unauthorized/
    );
  } finally {
    global.fetch = orig;
  }
});

test('callLLM com provider desconhecido lança erro', async () => {
  await assert.rejects(callLLM({ provider: 'unknown', model: 'x', prompt: 'y', apiKey: 'k' }), /provider/);
});

test('callLLM mede duration_ms', async () => {
  const orig = global.fetch;
  global.fetch = async () => {
    await new Promise((r) => setTimeout(r, 10));
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
  };
  try {
    const r = await callLLM({ provider: 'openrouter', model: 'm', prompt: 'p', apiKey: 'k' });
    assert.ok(r.duration_ms >= 10);
  } finally {
    global.fetch = orig;
  }
});
