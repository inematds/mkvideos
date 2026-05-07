'use strict';

/**
 * idea-loop.js — Task 10.1
 * Propõe templates YAML via LLM, valida com AJV, escreve em templates/inbox/.
 */

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const SCHEMA = require('../schema/template.schema.json');
const { callLLM } = require('./llm-client');
const { loadProfissoes } = require('./profissoes-loader');

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validate = ajv.compile(SCHEMA);

/**
 * Monta prompt para o LLM a partir do briefing e de uma profissão-sample.
 * @param {string} briefing
 * @param {object} sampleProfile
 * @returns {string}
 */
function buildPrompt(briefing, sampleProfile) {
  const slotKeys = Object.keys(sampleProfile.props || {});
  return `Você é um diretor criativo gerando templates de vídeo curto para profissionais brasileiros.

BRIEFING DO USUÁRIO:
${briefing}

VOCÊ DEVE devolver um YAML válido seguindo o schema abaixo. Use slots de profissão entre chaves.

SLOTS DISPONÍVEIS (do catálogo de profissões; use entre chaves, ex: {classic_task}):
${slotKeys.join(', ')}

REGRAS:
- script: array com 3-6 blocks (type=fixed|slot|rewrite|hook). Use rewrite com instruction usando slots para variar por profissão.
- visual.shots: array com 2-4 shots. Use prompt.type=slot|fixed|rewrite com a mesma gramática.
- format.key: short_reel | storytelling | micro_doc.
- hook.policy: default (com hook.text rewrite gerando frase empática+vanguarda).
- variation.seed_strategy: profissao_hash.
- llm.provider: openrouter, llm.model: anthropic/claude-sonnet-4.6.
- meta.id: kebab-case curto e único.
- meta.created_by: llm.

DEVOLVA SOMENTE O YAML, SEM CERCAS DE CÓDIGO, SEM TEXTO EXTRA.`;
}

/**
 * Remove cercas de código se o LLM desobedeceu a instrução.
 * @param {string} text
 * @returns {string}
 */
function stripFences(text) {
  return text.replace(/^```(yaml|yml)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

/**
 * Propõe N templates via LLM, valida cada um e escreve os aprovados em outDir.
 *
 * @param {object} opts
 * @param {string} opts.briefing        - Instrução criativa do usuário
 * @param {number} [opts.count=3]       - Quantos templates gerar
 * @param {object} opts.llmCfg          - { provider, model, max_tokens? }
 * @param {string} opts.apiKey          - API key do OpenRouter
 * @param {string} opts.profissoesCatalogPath - Caminho absoluto para profissoes-30.js
 * @param {string} opts.outDir          - Diretório de destino (templates/inbox)
 * @returns {Promise<string[]>}         - Paths dos arquivos escritos
 */
async function proposeTemplates({ briefing, count = 3, llmCfg, apiKey, profissoesCatalogPath, outDir }) {
  const cat = loadProfissoes(profissoesCatalogPath);
  const sample = cat[0];
  const proposed = [];

  for (let i = 0; i < count; i++) {
    let attempt = 0;
    let parsed = null;
    let errors = null;

    while (attempt < 3) {
      const retryNote = errors
        ? `\n\nA tentativa anterior falhou com os seguintes erros de validação: ${errors}. Corrija-os e tente novamente.`
        : '';
      const prompt = buildPrompt(briefing, sample) + retryNote;

      let r;
      try {
        r = await callLLM({
          ...llmCfg,
          prompt,
          apiKey,
          max_tokens: llmCfg.max_tokens || 2000,
          temperature: 0.8,
        });
      } catch (e) {
        errors = `LLM error: ${e.message}`;
        attempt++;
        continue;
      }

      try {
        parsed = yaml.load(stripFences(r.text));
      } catch (e) {
        errors = `YAML parse error: ${e.message}`;
        attempt++;
        continue;
      }

      if (!validate(parsed)) {
        errors = validate.errors.map((e) => `${e.instancePath} ${e.message}`).join('; ');
        parsed = null;
        attempt++;
        continue;
      }

      break; // válido
    }

    if (!parsed || !validate(parsed)) {
      console.warn(`[idea-loop] template ${i + 1}/${count} inválido após 3 tentativas — descartado. Erros: ${errors}`);
      continue;
    }

    const id = parsed.meta?.id || `llm-template-${Date.now()}-${i}`;
    const out = path.join(outDir, `${id}.yml`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(out, yaml.dump(parsed));
    proposed.push(out);
    console.log(`[idea-loop] template ${i + 1}/${count} gerado: ${out}`);
  }

  return proposed;
}

module.exports = { proposeTemplates, buildPrompt, stripFences };
