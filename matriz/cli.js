'use strict';

/**
 * cli.js — CLI complementar da Fábrica Matriz (Task 10.2).
 *
 * Subcomandos:
 *   review-inbox                         — revisa YAMLs em templates/inbox/
 *   batch-status <batch_id> <template_id> — exibe status de um batch
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ROOT = __dirname;
const INBOX = path.join(ROOT, 'templates/inbox');
const APPROVED = path.join(ROOT, 'templates/approved');
const ARCHIVE = path.join(ROOT, 'templates/archive');

/**
 * Lê uma linha do stdin com uma pergunta.
 * @param {string} q
 * @returns {Promise<string>}
 */
function ask(q) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => {
      rl.close();
      res(a.trim());
    });
  });
}

/**
 * review-inbox — lista YAMLs em templates/inbox/ e pede ação para cada um.
 */
async function reviewInbox() {
  if (!fs.existsSync(INBOX)) {
    console.log('Inbox não existe.');
    return;
  }

  const files = fs.readdirSync(INBOX).filter((f) => f.endsWith('.yml'));
  if (!files.length) {
    console.log('Inbox vazio.');
    return;
  }

  console.log(`\n${files.length} template(s) para revisar.\n`);

  for (const f of files) {
    const full = path.join(INBOX, f);
    console.log('\n' + '='.repeat(60));
    console.log(`Template: ${f}`);
    console.log('='.repeat(60));
    console.log(fs.readFileSync(full, 'utf8'));

    const ans = (await ask('[a]prova / [r]ejeita / [s]kip: ')).toLowerCase();

    if (ans === 'a' || ans === 'aprova') {
      fs.mkdirSync(APPROVED, { recursive: true });
      fs.renameSync(full, path.join(APPROVED, f));
      console.log('  → approved/');
    } else if (ans === 'r' || ans === 'rejeita') {
      const motivo = await ask('  motivo (opcional, Enter para pular): ');
      fs.mkdirSync(ARCHIVE, { recursive: true });
      fs.renameSync(full, path.join(ARCHIVE, f));
      if (motivo) {
        const sidecar = path.join(ARCHIVE, `${f.replace('.yml', '')}.reject.txt`);
        fs.writeFileSync(sidecar, motivo);
      }
      console.log('  → archive/');
    } else {
      console.log('  (skipped)');
    }
  }

  console.log('\nRevisão concluída.');
}

/**
 * batch-status — exibe resumo de um batch a partir do JSON de summary.
 * @param {string} batchId
 * @param {string} templateId
 */
function batchStatus(batchId, templateId) {
  if (!batchId || !templateId) {
    console.error('uso: node cli.js batch-status <batch_id> <template_id>');
    process.exit(1);
  }

  const summaryPath = path.join(ROOT, 'output', templateId, '_batches', `${batchId}.json`);

  if (!fs.existsSync(summaryPath)) {
    console.log(`não encontrado: ${summaryPath}`);
    return;
  }

  let s;
  try {
    s = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch (e) {
    console.error(`erro ao ler summary: ${e.message}`);
    process.exit(1);
  }

  console.log(`\nBatch ${s.batch_id} — template=${s.template?.id || templateId}`);
  console.log(`  status: ${s.totals?.done ?? '?'}/${s.totals?.planned ?? '?'} ok, ${s.totals?.failed ?? '?'} fail`);
  console.log(`  iniciado:  ${s.started_at || '(desconhecido)'}`);
  console.log(`  terminado: ${s.ended_at || '(em andamento)'}`);

  if (Array.isArray(s.videos) && s.videos.length) {
    console.log('');
    for (const v of s.videos) {
      const mark = v.status === 'done' ? '✓' : v.status === 'failed' ? '✗' : '·';
      const err = v.error_message ? ` — ${v.error_message}` : '';
      console.log(`  ${mark} ${v.slug}${err}`);
    }
  }
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === 'review-inbox') return reviewInbox();
  if (cmd === 'batch-status') return batchStatus(process.argv[3], process.argv[4]);

  console.log('uso: node cli.js <comando>');
  console.log('');
  console.log('comandos:');
  console.log('  review-inbox                          lista e aprova/rejeita YAMLs em templates/inbox/');
  console.log('  batch-status <batch_id> <template_id> exibe status de vídeos de um batch');
}

main().catch((e) => {
  console.error('erro:', e.message);
  process.exit(1);
});
