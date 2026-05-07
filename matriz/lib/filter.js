function parseFilter(str) {
  if (!str) return {};
  const out = {};
  for (const part of String(str).split(',')) {
    const [k, v] = part.split(':');
    if (k && v) out[k.trim()] = v.trim();
  }
  return out;
}

function applyFilter(catalog, filter, limit) {
  let out = catalog.filter((p) => Object.entries(filter).every(([k, v]) => p[k] === v));
  if (limit) out = out.slice(0, limit);
  return out;
}

module.exports = { parseFilter, applyFilter };
