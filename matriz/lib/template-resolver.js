/**
 * template-resolver.js
 * Resolve blocos de texto (fixed/slot) substituindo slots por valores do profile.
 * Tipos async (rewrite/hook) ficam para Phase 5.
 */

'use strict';

/**
 * Substitui {slot} no template pelos valores do profile e extras.
 * @param {string} template
 * @param {{ slug: string, label: string, props: Object }} profile
 * @param {Object} [extras]
 * @returns {string}
 */
function resolveText(template, profile, extras = {}) {
  const ctx = { profissao_label: profile.label, ...profile.props, ...extras };
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, k) => {
    if (k in ctx) return String(ctx[k]);
    throw new Error(`slot ausente: ${k} (profissão=${profile.slug})`);
  });
}

/**
 * Resolve um bloco de script (fixed ou slot) para { type, role, text }.
 * Lança erro para tipos não suportados nesta fase (rewrite, hook).
 * @param {{ type: string, role: string, text?: string, template?: string }} block
 * @param {Object} profile
 * @param {Object} [extras]
 * @returns {{ type: string, role: string, text: string }}
 */
function resolveScriptBlock(block, profile, extras = {}) {
  if (block.type === 'fixed') {
    return { type: 'fixed', role: block.role, text: resolveText(block.text, profile, extras) };
  }
  if (block.type === 'slot') {
    return { type: 'slot', role: block.role, text: resolveText(block.template, profile, extras) };
  }
  throw new Error(`block.type não suportado nesta fase: ${block.type}`);
}

/**
 * Resolve um bloco de prompt (fixed ou slot) para string final.
 * Lança erro para tipos não suportados nesta fase (rewrite).
 * @param {{ type: string, text?: string, template?: string }} block
 * @param {Object} profile
 * @param {Object} [extras]
 * @returns {string}
 */
function resolvePromptBlock(block, profile, extras = {}) {
  if (block.type === 'fixed') return block.text;
  if (block.type === 'slot') return resolveText(block.template, profile, extras);
  throw new Error(`prompt.type não suportado nesta fase: ${block.type}`);
}

async function resolveScriptBlockAsync(block, profile, extras, opts) {
  if (block.type === 'fixed' || block.type === 'slot') {
    return resolveScriptBlock(block, profile, extras);
  }
  if (block.type === 'rewrite') {
    const prompt = resolveText(block.instruction, profile, extras);
    const r = await opts.llmFn({
      provider: opts.llmCfg.provider,
      model: opts.llmCfg.model,
      max_tokens: opts.llmCfg.max_tokens,
      apiKey: opts.apiKey,
      prompt,
      temperature: opts.temperature,
      seed: opts.seed,
    });
    return {
      type: 'rewrite',
      role: block.role,
      text: r.text,
      _llm: {
        prompt,
        response: r.text,
        tokens_in: r.tokens_in,
        tokens_out: r.tokens_out,
        duration_ms: r.duration_ms,
        model: opts.llmCfg.model,
        temperature: opts.temperature,
      },
    };
  }
  if (block.type === 'hook') {
    return { type: 'hook', role: block.role, _placeholder: true };
  }
  throw new Error(`type desconhecido: ${block.type}`);
}

async function resolveHookBlock(template, profile, extras, opts) {
  const h = template.hook;
  if (!h || h.policy === 'off') return null;
  let textBlock = h.text;
  if (h.policy === 'override' && opts.override) textBlock = opts.override;
  if (!textBlock) throw new Error('hook policy != off mas hook.text ausente');
  if (textBlock.type === 'fixed') {
    return { policy: h.policy, position: h.position, text: resolveText(textBlock.text, profile, extras) };
  }
  if (textBlock.type === 'slot') {
    return { policy: h.policy, position: h.position, text: resolveText(textBlock.template, profile, extras) };
  }
  if (textBlock.type === 'rewrite') {
    const prompt = resolveText(textBlock.instruction, profile, extras);
    const r = await opts.llmFn({
      provider: opts.llmCfg.provider,
      model: opts.llmCfg.model,
      max_tokens: opts.llmCfg.max_tokens,
      apiKey: opts.apiKey,
      prompt,
      temperature: opts.temperature,
      seed: opts.seed,
    });
    return {
      policy: h.policy,
      position: h.position,
      text: r.text,
      _llm: {
        prompt,
        response: r.text,
        tokens_in: r.tokens_in,
        tokens_out: r.tokens_out,
        duration_ms: r.duration_ms,
        model: opts.llmCfg.model,
        temperature: opts.temperature,
      },
    };
  }
  throw new Error('hook.text.type desconhecido');
}

module.exports = { resolveText, resolveScriptBlock, resolvePromptBlock, resolveScriptBlockAsync, resolveHookBlock };
