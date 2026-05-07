const path = require('node:path');
const { loadTemplate } = require('./lib/template-loader');
const { loadProfissoes } = require('./lib/profissoes-loader');
const { applyFilter, parseFilter } = require('./lib/filter');
const { generateSingle } = require('./lib/single-video');
const { runId } = require('./lib/output-paths');

function parseArgs(argv) {
  const args = { template: argv[2], filter: '', limit: undefined, gate: 'none', reseed: false };
  for (const a of argv.slice(3)) {
    if (a.startsWith('--filter=')) args.filter = a.slice(9);
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.slice(8), 10);
    else if (a.startsWith('--gate=')) args.gate = a.slice(7);
    else if (a === '--reseed') args.reseed = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.template) {
    console.error('uso: node run.js <template.yml> [--filter=k:v] [--limit=N] [--gate=sample|none] [--reseed]');
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

  const batchId = runId();
  console.log(`[matriz] template=${template.meta.id} subset=${subset.length} batch=${batchId}`);

  for (let i = 0; i < subset.length; i += 1) {
    const p = subset[i];
    console.log(`[${i + 1}/${subset.length}] ${p.slug} ...`);
    try {
      const r = await generateSingle({ template, profile: p, batchId, reseed: args.reseed });
      console.log(`  ✓ ${r.video}`);
    } catch (e) {
      console.error(`  ✗ ${p.slug}: ${e.message}`);
    }
  }
}

main();
