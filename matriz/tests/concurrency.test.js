const test = require('node:test');
const assert = require('node:assert');
const { runWithLimit } = require('../lib/concurrency');

test('runWithLimit roda no máximo N em paralelo', async () => {
  let active = 0, peak = 0;
  const tasks = Array.from({ length: 6 }, (_, i) => async () => {
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 50));
    active--;
    return i;
  });
  const results = await runWithLimit(tasks, 2);
  assert.deepStrictEqual([...results].sort((a,b) => a-b), [0, 1, 2, 3, 4, 5]);
  assert.ok(peak <= 2, `peak ${peak} excedeu limit 2`);
});

test('runWithLimit captura erros via onError sem matar lote', async () => {
  const tasks = [
    async () => 'ok1',
    async () => { throw new Error('boom'); },
    async () => 'ok3',
  ];
  const results = await runWithLimit(tasks, 2, { onError: (e, i) => ({ failed: true, i, err: e.message }) });
  assert.strictEqual(results[0], 'ok1');
  assert.ok(results[1].failed);
  assert.strictEqual(results[1].err, 'boom');
  assert.strictEqual(results[2], 'ok3');
});

test('runWithLimit sem onError propaga erro', async () => {
  const tasks = [
    async () => 'ok',
    async () => { throw new Error('boom'); },
  ];
  await assert.rejects(runWithLimit(tasks, 2), /boom/);
});

test('runWithLimit com lista vazia retorna []', async () => {
  const r = await runWithLimit([], 4);
  assert.deepStrictEqual(r, []);
});

test('runWithLimit limit > tasks usa só workers necessários', async () => {
  const tasks = [async () => 1, async () => 2];
  const r = await runWithLimit(tasks, 10);
  assert.deepStrictEqual(r.sort(), [1, 2]);
});
