const path = require('node:path');
const { loadTemplate } = require('./lib/template-loader');
const { loadProfissoes } = require('./lib/profissoes-loader');
const { applyFilter, parseFilter } = require('./lib/filter');
const { runBatch } = require('./lib/batch-runner');

function parseArgs(argv) {
  const args = { template: argv[2], filter: '', limit: undefined, gate: 'none', reseed: false, concurrency: undefined };
  for (const a of argv.slice(3)) {
    if (a.startsWith('--filter=')) args.filter = a.slice(9);
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.slice(8), 10);
    else if (a.startsWith('--gate=')) args.gate = a.slice(7);
    else if (a === '--reseed') args.reseed = true;
    else if (a.startsWith('--concurrency=')) args.concurrency = parseInt(a.slice(14), 10);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.template) {
    console.error('uso: node run.js <template.yml> [--filter=k:v] [--limit=N] [--gate=sample|none] [--reseed] [--concurrency=N]');
    process.exit(1);
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

  console.log(`[matriz] template=${template.meta.id} subset=${subset.length}`);

  const result = await runBatch({
    template,
    subset,
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
}

main();
