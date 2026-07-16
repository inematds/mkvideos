const crypto = require('node:crypto');

function hash32(str) {
  const h = crypto.createHash('sha256').update(str).digest();
  return h.readUInt32BE(0);
}

function resolveSeed(variation, slug, reseed) {
  if (reseed) return hash32(`${slug}::${Date.now()}::${Math.random()}`);
  return hash32(`${slug}::${variation.seed_strategy || 'profissao_hash'}`);
}

function deriveBlockSeed(baseSeed, role) {
  return hash32(`${baseSeed}::${role}`);
}

module.exports = { resolveSeed, deriveBlockSeed };
