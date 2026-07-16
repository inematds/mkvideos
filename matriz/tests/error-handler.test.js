const test = require('node:test');
const assert = require('node:assert');
const { categorizeError, withRetry } = require('../lib/error-handler');

test('categorizeError reconhece transient (timeout/ECONN)', () => {
  assert.strictEqual(categorizeError(new Error('ETIMEDOUT')), 'transient');
  assert.strictEqual(categorizeError(new Error('ECONNRESET')), 'transient');
  assert.strictEqual(categorizeError(new Error('rate_limit_exceeded')), 'transient');
  assert.strictEqual(categorizeError(new Error('HTTP 429 too many requests')), 'transient');
  assert.strictEqual(categorizeError(new Error('HTTP 503 service unavailable')), 'transient');
});

test('categorizeError reconhece slot/schema', () => {
  assert.strictEqual(categorizeError(new Error('slot ausente: foo')), 'slot');
  assert.strictEqual(categorizeError(new Error('Template schema inválido: ...')), 'schema');
});

test('categorizeError reconhece qa e fatal', () => {
  assert.strictEqual(categorizeError(new Error('storytree QA: ...')), 'qa');
  assert.strictEqual(categorizeError(new Error('ENOSPC')), 'fatal');
  assert.strictEqual(categorizeError(new Error('ffmpeg not found')), 'fatal');
});

test('categorizeError unknown para mensagens arbitrárias', () => {
  assert.strictEqual(categorizeError(new Error('algo aconteceu')), 'unknown');
});

test('withRetry repete em transient até sucesso', async () => {
  let n = 0;
  const fn = async () => { n++; if (n < 3) throw new Error('ETIMEDOUT'); return 'ok'; };
  const r = await withRetry(fn, { attempts: 3, baseMs: 1 });
  assert.strictEqual(r, 'ok');
  assert.strictEqual(n, 3);
});

test('withRetry NÃO repete em slot/schema (fatal)', async () => {
  let n = 0;
  const fn = async () => { n++; throw new Error('slot ausente: x'); };
  await assert.rejects(withRetry(fn, { attempts: 3, baseMs: 1 }), /slot ausente/);
  assert.strictEqual(n, 1);
});

test('withRetry esgota attempts em transient persistente', async () => {
  let n = 0;
  const fn = async () => { n++; throw new Error('ETIMEDOUT'); };
  await assert.rejects(withRetry(fn, { attempts: 3, baseMs: 1 }), /ETIMEDOUT/);
  assert.strictEqual(n, 3);
});

test('withRetry funciona sem opts (defaults)', async () => {
  let n = 0;
  const fn = async () => { n++; if (n === 1) throw new Error('ETIMEDOUT'); return 'ok'; };
  const r = await withRetry(fn, { baseMs: 1 });  // defaults: attempts=3
  assert.strictEqual(r, 'ok');
});
