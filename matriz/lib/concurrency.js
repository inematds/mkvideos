async function runWithLimit(taskFns, limit, opts = {}) {
  const results = new Array(taskFns.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= taskFns.length) return;
      try {
        results[i] = await taskFns[i]();
      } catch (e) {
        if (opts.onError) results[i] = opts.onError(e, i);
        else throw e;
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, taskFns.length) }, worker);
  await Promise.all(workers);
  return results;
}

module.exports = { runWithLimit };
