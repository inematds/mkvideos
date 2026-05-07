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

module.exports = { resolveText, resolveScriptBlock, resolvePromptBlock };
