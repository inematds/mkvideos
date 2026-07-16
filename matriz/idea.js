'use strict';

/**
 * idea.js — CLI entrypoint para o idea-loop (Task 10.1).
 * Uso: node idea.js "<briefing>"
 */

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { proposeTemplates } = require('./lib/idea-loop');

async function main() {
  const briefing = process.argv.slice(2).join(' ').trim();
  if (!briefing) {
    console.error('uso: node idea.js "<briefing>"');
    process.exit(1);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY não setada (verifique ../.env do mkvideos)');
    process.exit(1);
  }

  const count = parseInt(process.env.MATRIZ_IDEA_COUNT || '3', 10);
  const model = process.env.MATRIZ_IDEA_MODEL || 'anthropic/claude-sonnet-4-6';

  console.log(`\nGerando ${count} template(s) via LLM (${model})...`);

  const out = await proposeTemplates({
    briefing,
    count,
    llmCfg: { provider: 'openrouter', model },
    apiKey: process.env.OPENROUTER_API_KEY,
    profissoesCatalogPath: path.join(__dirname, '../config/profissoes-30.js'),
    outDir: path.join(__dirname, 'templates/inbox'),
  });

  console.log(`\nGerados ${out.length} templates em templates/inbox/:`);
  for (const f of out) console.log(`  ${f}`);

  if (out.length > 0) {
    console.log(`\nRevise com: node cli.js review-inbox`);
  } else {
    console.log('\nNenhum template válido gerado. Verifique o briefing ou tente novamente.');
  }
}

main().catch((e) => {
  console.error('erro:', e.message);
  process.exit(1);
});
