const path = require('node:path');

function loadProfissoes(catalogPath, baseDir) {
  const abs = baseDir ? path.resolve(baseDir, catalogPath) : path.resolve(catalogPath);
  const mod = require(abs);
  const arr = mod.profissoes || mod.default || mod;
  if (!Array.isArray(arr)) {
    throw new Error(`Catálogo ${abs} não exporta array de profissões`);
  }
  return arr;
}

module.exports = { loadProfissoes };
