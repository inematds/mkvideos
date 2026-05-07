const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const yaml = require('js-yaml');
const Ajv = require('ajv');

const SCHEMA = require('../schema/template.schema.json');
const DEFAULTS_PATH = path.join(__dirname, '../config/defaults.yml');

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validate = ajv.compile(SCHEMA);

let _defaultsCache = null;
function getDefaults() {
  if (_defaultsCache) return _defaultsCache;
  try {
    _defaultsCache = yaml.load(fs.readFileSync(DEFAULTS_PATH, 'utf8')) || {};
  } catch (e) {
    _defaultsCache = {};
  }
  return _defaultsCache;
}

function loadTemplate(filePath) {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  const obj = yaml.load(raw);
  if (!validate(obj)) {
    const errs = validate.errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
    throw new Error(`Template schema inválido: ${errs}`);
  }
  obj._meta = { file_path: abs, file_sha256: sha256 };
  obj._defaults = getDefaults();
  return obj;
}

module.exports = { loadTemplate };
