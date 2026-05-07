/**
 * LLM client — wrapper minimal para chat completions via OpenRouter.
 * Usado pelo template-resolver (Task 5.2) e idea-loop (Task 10.1).
 */

/**
 * @param {object} opts
 * @param {'openrouter'} opts.provider
 * @param {string} opts.model
 * @param {string} opts.prompt
 * @param {number} [opts.temperature=0.7]
 * @param {number} [opts.max_tokens=500]
 * @param {string} opts.apiKey
 * @param {number} [opts.seed]
 * @returns {Promise<{text: string, tokens_in: number, tokens_out: number, duration_ms: number, raw: object}>}
 */
async function callLLM({ provider, model, prompt, temperature = 0.7, max_tokens = 500, apiKey, seed }) {
  if (provider !== 'openrouter') {
    throw new Error(`provider não suportado: ${provider}`);
  }
  const t0 = Date.now();
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens,
  };
  if (seed !== undefined) body.seed = seed;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    text: (data.choices[0].message.content || '').trim(),
    tokens_in: data.usage?.prompt_tokens || 0,
    tokens_out: data.usage?.completion_tokens || 0,
    duration_ms: Date.now() - t0,
    raw: data,
  };
}

module.exports = { callLLM };
