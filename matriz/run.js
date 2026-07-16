const path = require('node:path');
const readline = require('node:readline');
const { loadTemplate } = require('./lib/template-loader');
const { loadProfissoes } = require('./lib/profissoes-loader');
const { applyFilter, parseFilter } = require('./lib/filter');
const { runBatch } = require('./lib/batch-runner');
const { collectSlots, checkSlotIntegrity, estimateBudget } = require('./lib/preflight');
const { pickSample } = require('./lib/gates');
const { replayManifest } = require('./lib/replay');
const { loadBatchSummary, failedSlugs } = require('./lib/resume');

function ask(q) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => { rl.close(); res(a.trim().toLowerCase()); });
  });
}

function parseArgs(argv) {
  const args = { template: argv[2], filter: '', limit: undefined, gate: 'none', reseed: false, concurrency: undefined, resume: undefined };
  for (const a of argv.slice(3)) {
    if (a.startsWith('--filter=')) args.filter = a.slice(9);
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.slice(8), 10);
    else if (a.startsWith('--gate=')) args.gate = a.slice(7);
    else if (a === '--reseed') args.reseed = true;
    else if (a.startsWith('--concurrency=')) args.concurrency = parseInt(a.slice(14), 10);
    else if (a.startsWith('--resume=')) args.resume = a.slice(9);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.template) {
    console.error('uso: node run.js <template.yml | manifest.json> [--filter=k:v] [--limit=N] [--gate=sample|none] [--reseed] [--concurrency=N] [--resume=<batch_id>]');
    process.exit(1);
  }

  // Detectar replay: primeiro arg termina em manifest.json
  if (args.template.endsWith('manifest.json')) {
    const out = await replayManifest(path.resolve(args.template));
    console.log(`replayed: ${out}`);
    process.exit(0);
  }

  const template = loadTemplate(args.template);
  const templDir = path.dirname(path.resolve(args.template));
  const catalog = loadProfissoes(template.target.catalog, templDir);
  const filter = { ...template.target.filter, ...parseFilter(args.filter) };
  const subset = applyFilter(catalog, filter, args.limit);

  if (subset.length === 0) {
    console.error('Nenhuma profissão bate com o filter.');
    process.exit(1);
  }

  // Resume: filtrar por slugs failed/pending do batch anterior
  let resumeSubset = subset;
  if (args.resume) {
    const summary = loadBatchSummary(template.meta.id, args.resume);
    const slugs = new Set(failedSlugs(summary));
    resumeSubset = subset.filter((p) => slugs.has(p.slug));
    console.log(`[resume] retomando ${resumeSubset.length} videos do batch ${args.resume}`);
    if (resumeSubset.length === 0) {
      console.log('Nenhum video failed/pending no batch. Nada a fazer.');
      process.exit(0);
    }
  }

  // Pre-flight: slot integrity
  const slots = collectSlots(template);
  const integrity = checkSlotIntegrity(slots, resumeSubset);
  let runSubset = resumeSubset;
  if (integrity.missing.length) {
    console.warn(`\n⚠ ${integrity.missing.length} profissão(ões) com slots faltantes:`);
    for (const m of integrity.missing.slice(0, 5)) console.warn(`  ${m.slug}: faltam ${m.missing_slots.join(', ')}`);
    if (integrity.missing.length > 5) console.warn(`  ... +${integrity.missing.length - 5}`);
    const ans = await ask('  [a]bortar / [s]kip-faltantes / [c]ontinuar com warning: ');
    if (ans === 'a') process.exit(1);
    if (ans === 's') runSubset = integrity.complete;
  }

  // Pre-flight: orçamento
  const budget = estimateBudget(template, runSubset);
  console.log(`\nPre-flight: ${budget.videos} vídeos | ${budget.llmCalls} chamadas LLM (~${budget.tokensEst} tokens) | ${budget.images} imagens`);
  const go = await ask('OK? [y/N]: ');
  if (go !== 'y' && go !== 's' && go !== 'sim') { console.log('cancelado.'); process.exit(0); }

  console.log(`[matriz] template=${template.meta.id} subset=${runSubset.length}`);

  let toRun = runSubset;
  let sampleSet = null;
  if (args.gate === 'sample') {
    sampleSet = pickSample(runSubset, Math.min(5, runSubset.length));
    console.log(`\n[gate=sample] gerando ${sampleSet.length} amostras primeiro: ${sampleSet.map((p) => p.slug).join(', ')}`);
    toRun = sampleSet;
  }

  const result = await runBatch({
    template,
    subset: toRun,
    gateMode: args.gate,
    reseed: args.reseed,
    concurrency: args.concurrency || 4,
    onProgress: ({ idx, total, slug, status, error }) => {
      const stamp = new Date().toISOString().slice(11, 19);
      console.log(`[${stamp}] [${idx + 1}/${total}] ${slug} — ${status}${error ? ': ' + error : ''}`);
    },
  });

  console.log(`\nBatch ${result.batchId} done — ${result.summary.totals.done} ok / ${result.summary.totals.failed} fail`);
  console.log(`Summary: ${result.summaryFile}`);

  if (args.gate === 'sample' && sampleSet && result.summary.totals.failed < toRun.length) {
    console.log(`\nAmostras geradas. Veja na UI: http://localhost:5278/batch/${template.meta.id}/${result.batchId}`);
    const proceed = await ask('Aprovar e gerar restante? [y/N]: ');
    if (proceed === 'y' || proceed === 's' || proceed === 'sim') {
      const remaining = runSubset.filter((p) => !sampleSet.find((s) => s.slug === p.slug));
      console.log(`\nGerando ${remaining.length} restantes...`);
      const restResult = await runBatch({
        template,
        subset: remaining,
        gateMode: 'sample-rest',
        reseed: args.reseed,
        concurrency: args.concurrency || 4,
        onProgress: ({ idx, total, slug, status, error }) => {
          const stamp = new Date().toISOString().slice(11, 19);
          console.log(`[${stamp}] [${idx + 1}/${total}] ${slug} — ${status}${error ? ': ' + error : ''}`);
        },
      });
      console.log(`\nLote completo: ${result.summary.totals.done + restResult.summary.totals.done} ok / ${result.summary.totals.failed + restResult.summary.totals.failed} fail`);
    } else {
      console.log('Lote interrompido após amostra. Use --resume com batch_id pra retomar.');
    }
  }
}

main();
