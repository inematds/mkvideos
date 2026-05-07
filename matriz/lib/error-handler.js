'use strict';

function categorizeError(e) {
  const m = e.message || '';
  if (/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|rate.?limit|429|503|504/i.test(m)) return 'transient';
  if (/slot ausente/i.test(m)) return 'slot';
  if (/schema inválido|schema invalid/i.test(m)) return 'schema';
  if (/storytree QA/i.test(m)) return 'qa';
  if (/ENOSPC|EACCES|EPERM|ffmpeg/i.test(m)) return 'fatal';
  return 'unknown';
}

async function withRetry(fn, { attempts = 3, baseMs = 1000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (categorizeError(e) !== 'transient') throw e;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, baseMs * Math.pow(4, i)));
    }
  }
  throw lastErr;
}

module.exports = { categorizeError, withRetry };
