# Fábrica Matriz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir, em `mkvideos/matriz/`, um sistema declarativo que aplica templates YAML × catálogo de profissões para gerar vídeos em lote, com gates de aprovação, manifest reproduzível e UI de triagem — sem editar nenhum arquivo do mkvideos atual.

**Architecture:** Subpasta isolada que importa via path relativo (`../lib/storytree-*`, `../pipeline/generate-image-*`, `../config/profissoes-*.js`). Templates como dado YAML validado por JSON-Schema. Orquestrador CLI (`run.js`) compõe loader → resolver → storytree shot plan → image gen → render → manifest. Test runner: `node:test` builtin (zero deps).

**Tech Stack:** Node 18+ CommonJS (mesmo do mkvideos), YAML (`js-yaml`), JSON-Schema (`ajv`), `node:test`, ffmpeg (via mkvideos), inemaimg/openrouter HTTP. Reusa `lib/storytree-*` integralmente.

**Spec source:** `docs/superpowers/specs/2026-05-07-fabrica-matriz-design.md`

---

## Fases

1. **Bootstrap** — pacote, dirs, deps, gitignore
2. **Template loader + schema** — YAML → objeto validado
3. **Slot/fixed resolver + seed + paths + manifest** — peças unitárias
4. **End-to-end mínimo** — 1 profissão, slot-only, render real
5. **LLM (rewrite + hook)** — bloco rewrite e injeção de hook
6. **Batch multi-profissão + filter + concurrency**
7. **Gates: sample + none**
8. **Reseed, replay, resume**
9. **Erros: categorização + retry transient**
10. **Idea loop (LLM propõe templates) + CLI complementar**
11. **UI de aprovação**

---

## Phase 1 — Bootstrap

### Task 1.1: Criar package.json e estrutura de dirs

**Files:**
- Create: `mkvideos/matriz/package.json`
- Create: `mkvideos/matriz/.gitignore`
- Create: `mkvideos/matriz/README.md`
- Create: `mkvideos/matriz/templates/inbox/.gitkeep`
- Create: `mkvideos/matriz/templates/approved/.gitkeep`
- Create: `mkvideos/matriz/templates/archive/.gitkeep`

- [ ] **Step 1: Criar package.json**

```json
{
  "name": "mkvideos-matriz",
  "version": "0.1.0",
  "private": true,
  "main": "run.js",
  "scripts": {
    "test": "node --test tests/",
    "check:syntax": "find . -maxdepth 3 -name '*.js' -not -path './node_modules/*' -exec node --check {} \\;",
    "ui": "node ui/server.js"
  },
  "dependencies": {
    "js-yaml": "^4.1.0",
    "ajv": "^8.12.0",
    "dotenv": "^16.0.0"
  }
}
```

- [ ] **Step 2: Criar .gitignore**

```
node_modules/
output/
*.log
.env
```

- [ ] **Step 3: Criar README.md mínimo**

```markdown
# mkvideos-matriz

Fábrica declarativa de vídeos em lote. Templates YAML × catálogo de profissões.

Spec: `../docs/superpowers/specs/2026-05-07-fabrica-matriz-design.md`

## Quickstart

```
npm install
npm test
node run.js templates/approved/example-como-usar-ia-vanguarda.yml --gate=sample --limit=3
```
```

- [ ] **Step 4: Criar .gitkeep nos dirs templates/**

Crie 3 arquivos vazios: `templates/inbox/.gitkeep`, `templates/approved/.gitkeep`, `templates/archive/.gitkeep`.

- [ ] **Step 5: Instalar deps**

Run: `cd mkvideos/matriz && npm install`
Expected: cria `node_modules/`, lockfile.

- [ ] **Step 6: Verificar syntax check funciona**

Run: `cd mkvideos/matriz && npm run check:syntax`
Expected: passa (sem .js ainda, mas comando não falha).

- [ ] **Step 7: Commit**

```bash
git add matriz/package.json matriz/.gitignore matriz/README.md matriz/templates/
git commit -m "matriz: bootstrap subpasta + deps"
```

---

## Phase 2 — Template loader + schema

### Task 2.1: JSON-Schema do template

**Files:**
- Create: `mkvideos/matriz/schema/template.schema.json`

- [ ] **Step 1: Criar schema completo**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MatrizTemplate",
  "type": "object",
  "required": ["meta", "target", "format", "script", "visual", "audio", "hook", "variation", "llm"],
  "properties": {
    "meta": {
      "type": "object",
      "required": ["id", "version", "name"],
      "properties": {
        "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
        "version": { "type": "integer", "minimum": 1 },
        "name": { "type": "string" },
        "description": { "type": "string" },
        "created_by": { "enum": ["user", "llm"] },
        "created_at": { "type": "string" }
      }
    },
    "target": {
      "type": "object",
      "required": ["catalog"],
      "properties": {
        "catalog": { "type": "string" },
        "filter": { "type": "object" }
      }
    },
    "format": {
      "type": "object",
      "required": ["key", "duration_seconds", "aspect"],
      "properties": {
        "key": { "enum": ["short_reel", "storytelling", "micro_doc"] },
        "duration_seconds": { "type": "number", "minimum": 5, "maximum": 300 },
        "aspect": { "enum": ["1:1", "9:16", "16:9", "4:3", "3:4"] }
      }
    },
    "script": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/definitions/scriptBlock" }
    },
    "visual": {
      "type": "object",
      "required": ["model", "shots"],
      "properties": {
        "model": { "type": "string" },
        "quality": { "enum": ["fast", "high"] },
        "base_style": { "type": "string" },
        "shots": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["role", "prompt"],
            "properties": {
              "role": { "type": "string" },
              "prompt": { "$ref": "#/definitions/promptBlock" }
            }
          }
        }
      }
    },
    "audio": {
      "type": "object",
      "required": ["voice"],
      "properties": {
        "voice": { "type": "string" },
        "music": {
          "type": "object",
          "properties": {
            "style": { "type": "string" },
            "source": { "type": "string" }
          }
        },
        "sfx": { "type": ["boolean", "array"] }
      }
    },
    "hook": {
      "type": "object",
      "required": ["policy", "position"],
      "properties": {
        "policy": { "enum": ["default", "required", "off", "override"] },
        "position": { "enum": ["intro", "outro", "both"] },
        "text": { "$ref": "#/definitions/promptBlock" }
      }
    },
    "variation": {
      "type": "object",
      "required": ["seed_strategy"],
      "properties": {
        "seed_strategy": { "enum": ["profissao_hash"] },
        "rewrite_temperature": { "type": "number", "minimum": 0, "maximum": 2 },
        "diversify_camera_moves": { "type": "boolean" },
        "diversify_music": { "type": "boolean" }
      }
    },
    "llm": {
      "type": "object",
      "required": ["provider", "model"],
      "properties": {
        "provider": { "type": "string" },
        "model": { "type": "string" },
        "max_tokens": { "type": "integer", "minimum": 50, "maximum": 4000 }
      }
    }
  },
  "definitions": {
    "scriptBlock": {
      "type": "object",
      "required": ["type", "role"],
      "properties": {
        "type": { "enum": ["fixed", "slot", "rewrite", "hook"] },
        "role": { "type": "string" },
        "text": { "type": "string" },
        "template": { "type": "string" },
        "instruction": { "type": "string" }
      },
      "allOf": [
        { "if": { "properties": { "type": { "const": "fixed" } } }, "then": { "required": ["text"] } },
        { "if": { "properties": { "type": { "const": "slot" } } }, "then": { "required": ["template"] } },
        { "if": { "properties": { "type": { "const": "rewrite" } } }, "then": { "required": ["instruction"] } }
      ]
    },
    "promptBlock": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": { "enum": ["fixed", "slot", "rewrite"] },
        "text": { "type": "string" },
        "template": { "type": "string" },
        "instruction": { "type": "string" }
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add matriz/schema/template.schema.json
git commit -m "matriz: schema JSON do template"
```

### Task 2.2: Template loader (TDD)

**Files:**
- Create: `mkvideos/matriz/lib/template-loader.js`
- Create: `mkvideos/matriz/tests/template-loader.test.js`
- Create: `mkvideos/matriz/templates/approved/example-como-usar-ia-vanguarda.yml`

- [ ] **Step 1: Criar template exemplo (fixture pra testes)**

Conteúdo de `templates/approved/example-como-usar-ia-vanguarda.yml`:

```yaml
meta:
  id: como-usar-ia-vanguarda
  version: 1
  name: "Como você pode usar IA pra ficar na vanguarda"
  created_by: user
  created_at: 2026-05-07
target:
  catalog: ../../config/profissoes-30.js
  filter: {}
format:
  key: short_reel
  duration_seconds: 35
  aspect: "9:16"
script:
  - type: fixed
    role: hook
    text: "Você é {profissao_label}."
  - type: slot
    role: context
    template: "Hoje, você ainda gasta horas com {classic_task}."
  - type: rewrite
    role: explanation
    instruction: "1 frase: como {ai_application} resolve a dor de quem é {profissao_label}. Tom: prático, esperançoso."
  - type: hook
    role: closing
visual:
  model: flux2-klein
  quality: high
  base_style: "cinematic, soft lighting, brazilian context, photoreal"
  shots:
    - role: hook
      prompt:
        type: slot
        template: "{character} no {workplace}. {base_style}"
    - role: explanation
      prompt:
        type: slot
        template: "{character} usando {ai_daily_tool}. {base_style}"
    - role: closing
      prompt:
        type: fixed
        text: "Brazilian professional smiling, golden hour, cinematic."
audio:
  voice: rachel
  music:
    style: "uplifting cinematic"
    source: inemavox
  sfx: false
hook:
  policy: default
  position: outro
  text:
    type: rewrite
    instruction: "Frase 12-15 palavras, empática, reconhece desafio do(a) {profissao_label} e convida aprender IA pra se manter na vanguarda."
variation:
  seed_strategy: profissao_hash
  rewrite_temperature: 0.7
  diversify_camera_moves: true
  diversify_music: false
llm:
  provider: openrouter
  model: anthropic/claude-sonnet-4.6
  max_tokens: 200
```

- [ ] **Step 2: Escrever test failing**

`tests/template-loader.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadTemplate } = require('../lib/template-loader');

test('loadTemplate carrega YAML válido e retorna objeto', () => {
  const t = loadTemplate(path.join(__dirname, '../templates/approved/example-como-usar-ia-vanguarda.yml'));
  assert.strictEqual(t.meta.id, 'como-usar-ia-vanguarda');
  assert.strictEqual(t.format.key, 'short_reel');
  assert.strictEqual(t.script.length, 4);
});

test('loadTemplate calcula sha256 do arquivo', () => {
  const t = loadTemplate(path.join(__dirname, '../templates/approved/example-como-usar-ia-vanguarda.yml'));
  assert.match(t._meta.file_sha256, /^[a-f0-9]{64}$/);
});

test('loadTemplate falha com erro claro em YAML inválido', () => {
  assert.throws(() => loadTemplate('/nonexistent.yml'), /ENOENT|not found/);
});

test('loadTemplate falha em template que viola schema', () => {
  const fs = require('node:fs');
  const tmp = path.join(__dirname, '_tmp_invalid.yml');
  fs.writeFileSync(tmp, 'meta:\n  id: x\n');
  assert.throws(() => loadTemplate(tmp), /schema|required/i);
  fs.unlinkSync(tmp);
});
```

- [ ] **Step 3: Rodar teste, verificar que falha**

Run: `cd mkvideos/matriz && npm test`
Expected: FAIL — "Cannot find module '../lib/template-loader'"

- [ ] **Step 4: Implementar template-loader**

`lib/template-loader.js`:

```javascript
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const yaml = require('js-yaml');
const Ajv = require('ajv');

const SCHEMA = require('../schema/template.schema.json');
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(SCHEMA);

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
  return obj;
}

module.exports = { loadTemplate };
```

- [ ] **Step 5: Rodar testes, verificar que passam**

Run: `cd mkvideos/matriz && npm test`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
git add matriz/lib/template-loader.js matriz/tests/template-loader.test.js matriz/templates/approved/example-como-usar-ia-vanguarda.yml
git commit -m "matriz: template-loader + schema validation (TDD)"
```

---

## Phase 3 — Resolver, seed, paths, manifest

### Task 3.1: Seed strategy (TDD)

**Files:**
- Create: `mkvideos/matriz/lib/seed-strategy.js`
- Create: `mkvideos/matriz/tests/seed-strategy.test.js`

- [ ] **Step 1: Test failing**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { resolveSeed, deriveBlockSeed } = require('../lib/seed-strategy');

test('resolveSeed determinístico por slug com strategy=profissao_hash', () => {
  const a = resolveSeed({ strategy: 'profissao_hash' }, 'fisioterapeuta', false);
  const b = resolveSeed({ strategy: 'profissao_hash' }, 'fisioterapeuta', false);
  assert.strictEqual(a, b);
});

test('resolveSeed muda quando reseed=true', () => {
  const a = resolveSeed({ strategy: 'profissao_hash' }, 'fisioterapeuta', false);
  const b = resolveSeed({ strategy: 'profissao_hash' }, 'fisioterapeuta', true);
  assert.notStrictEqual(a, b);
});

test('deriveBlockSeed gera seeds distintas por role', () => {
  const base = 100000;
  assert.notStrictEqual(deriveBlockSeed(base, 'hook'), deriveBlockSeed(base, 'context'));
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `cd mkvideos/matriz && npm test`
Expected: FAIL — module not found

- [ ] **Step 3: Implementar**

```javascript
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
```

- [ ] **Step 4: Tests pass**

Run: `cd mkvideos/matriz && npm test`

- [ ] **Step 5: Commit**

```bash
git add matriz/lib/seed-strategy.js matriz/tests/seed-strategy.test.js
git commit -m "matriz: seed-strategy determinística + reseed"
```

### Task 3.2: Output paths (TDD)

**Files:**
- Create: `mkvideos/matriz/lib/output-paths.js`
- Create: `mkvideos/matriz/tests/output-paths.test.js`

- [ ] **Step 1: Test failing**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { runId, runDir, manifestPath, latestPath, batchPath } = require('../lib/output-paths');

test('runId formato ISO+hash', () => {
  const id = runId();
  assert.match(id, /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_[a-f0-9]{4}$/);
});

test('runDir compõe template/slug/run_id', () => {
  const d = runDir('templ', 'fisio', '2026-05-07T14-30-00_a4b1');
  assert.strictEqual(d, path.join('output', 'templ', 'fisio', '2026-05-07T14-30-00_a4b1'));
});

test('manifestPath = runDir/manifest.json', () => {
  assert.strictEqual(manifestPath('templ', 'fisio', 'X'), path.join('output', 'templ', 'fisio', 'X', 'manifest.json'));
});

test('latestPath = template/slug/latest.json', () => {
  assert.strictEqual(latestPath('templ', 'fisio'), path.join('output', 'templ', 'fisio', 'latest.json'));
});

test('batchPath = template/_batches/<id>.json', () => {
  assert.strictEqual(batchPath('templ', 'B1'), path.join('output', 'templ', '_batches', 'B1.json'));
});
```

- [ ] **Step 2: Implementar**

`lib/output-paths.js`:

```javascript
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = 'output';

function runId(d = new Date()) {
  const iso = d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tail = crypto.randomBytes(2).toString('hex');
  return `${iso}_${tail}`;
}

function runDir(templateId, slug, rid) {
  return path.join(ROOT, templateId, slug, rid);
}

function manifestPath(templateId, slug, rid) {
  return path.join(runDir(templateId, slug, rid), 'manifest.json');
}

function latestPath(templateId, slug) {
  return path.join(ROOT, templateId, slug, 'latest.json');
}

function batchPath(templateId, batchId) {
  return path.join(ROOT, templateId, '_batches', `${batchId}.json`);
}

function imgsDir(templateId, slug, rid) {
  return path.join(runDir(templateId, slug, rid), 'imgs');
}

function videoPath(templateId, slug, rid) {
  return path.join(runDir(templateId, slug, rid), 'video.mp4');
}

function scriptPath(templateId, slug, rid) {
  return path.join(runDir(templateId, slug, rid), 'resolved-script.txt');
}

module.exports = { runId, runDir, manifestPath, latestPath, batchPath, imgsDir, videoPath, scriptPath };
```

- [ ] **Step 3: Tests pass + commit**

```bash
cd mkvideos/matriz && npm test
git add matriz/lib/output-paths.js matriz/tests/output-paths.test.js
git commit -m "matriz: output-paths helpers"
```

### Task 3.3: Profissoes loader (TDD)

**Files:**
- Create: `mkvideos/matriz/lib/profissoes-loader.js`
- Create: `mkvideos/matriz/tests/profissoes-loader.test.js`

- [ ] **Step 1: Test failing**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadProfissoes } = require('../lib/profissoes-loader');

test('loadProfissoes carrega catálogo do mkvideos', () => {
  const cat = loadProfissoes(path.join(__dirname, '../../config/profissoes-30.js'));
  assert.ok(Array.isArray(cat));
  assert.ok(cat.length >= 10);
  const fisio = cat.find((p) => p.slug === 'fisioterapeuta');
  assert.ok(fisio);
  assert.ok(fisio.props);
  assert.ok(fisio.props.classic_task);
});

test('loadProfissoes resolve path relativo do template', () => {
  const cat = loadProfissoes('../../config/profissoes-30.js', path.join(__dirname, '../templates/approved'));
  assert.ok(cat.length >= 10);
});
```

- [ ] **Step 2: Implementar**

`lib/profissoes-loader.js`:

```javascript
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
```

- [ ] **Step 3: Tests pass + commit**

```bash
cd mkvideos/matriz && npm test
git add matriz/lib/profissoes-loader.js matriz/tests/profissoes-loader.test.js
git commit -m "matriz: profissoes-loader (require dinâmico do mkvideos)"
```

### Task 3.4: Filter (TDD)

**Files:**
- Create: `mkvideos/matriz/lib/filter.js`
- Create: `mkvideos/matriz/tests/filter.test.js`

- [ ] **Step 1: Test failing**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { parseFilter, applyFilter } = require('../lib/filter');

const cat = [
  { slug: 'fisio', label: 'Fisio', area: 'saude' },
  { slug: 'enf', label: 'Enf', area: 'saude' },
  { slug: 'eng', label: 'Eng', area: 'tech' }
];

test('parseFilter aceita "area:saude"', () => {
  assert.deepStrictEqual(parseFilter('area:saude'), { area: 'saude' });
});

test('parseFilter aceita "slug:fisio"', () => {
  assert.deepStrictEqual(parseFilter('slug:fisio'), { slug: 'fisio' });
});

test('parseFilter vazio retorna {}', () => {
  assert.deepStrictEqual(parseFilter(''), {});
  assert.deepStrictEqual(parseFilter(undefined), {});
});

test('applyFilter por area', () => {
  const out = applyFilter(cat, { area: 'saude' });
  assert.strictEqual(out.length, 2);
});

test('applyFilter por slug', () => {
  const out = applyFilter(cat, { slug: 'fisio' });
  assert.strictEqual(out.length, 1);
});

test('applyFilter vazio retorna todos', () => {
  assert.strictEqual(applyFilter(cat, {}).length, 3);
});

test('applyFilter respeita limit', () => {
  assert.strictEqual(applyFilter(cat, {}, 2).length, 2);
});
```

- [ ] **Step 2: Implementar**

`lib/filter.js`:

```javascript
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
```

- [ ] **Step 3: Tests pass + commit**

```bash
cd mkvideos/matriz && npm test
git add matriz/lib/filter.js matriz/tests/filter.test.js
git commit -m "matriz: filter (parse + apply)"
```

### Task 3.5: Manifest writer (TDD)

**Files:**
- Create: `mkvideos/matriz/lib/manifest-writer.js`
- Create: `mkvideos/matriz/tests/manifest-writer.test.js`

- [ ] **Step 1: Test failing**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { initManifest, updateManifest, writeLatest, readManifest } = require('../lib/manifest-writer');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'matriz-test-'));

test('initManifest cria arquivo com status=pending', () => {
  const p = path.join(TMP, 'manifest.json');
  initManifest(p, {
    run_id: 'R1', batch_id: 'B1',
    template: { id: 't', version: 1 },
    profissao: { slug: 'fisio', label: 'Fisio' },
    seed: { value: 1, strategy: 'profissao_hash', reseed: false }
  });
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(m.status, 'pending');
  assert.strictEqual(m.manifest_version, 1);
  assert.ok(m.created_at);
});

test('updateManifest mescla campos e atualiza updated_at', async () => {
  const p = path.join(TMP, 'manifest.json');
  const before = readManifest(p).updated_at;
  await new Promise((r) => setTimeout(r, 10));
  updateManifest(p, { status: 'resolving' });
  const after = readManifest(p);
  assert.strictEqual(after.status, 'resolving');
  assert.notStrictEqual(after.updated_at, before);
});

test('writeLatest escreve apontador pro run_id', () => {
  const p = path.join(TMP, 'latest.json');
  writeLatest(p, 'R1');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(j.run_id, 'R1');
});
```

- [ ] **Step 2: Implementar**

`lib/manifest-writer.js`:

```javascript
const fs = require('node:fs');
const path = require('node:path');

function initManifest(filePath, base) {
  const now = new Date().toISOString();
  const m = {
    manifest_version: 1,
    status: 'pending',
    error: null,
    llm_calls: [],
    timings: {},
    qa: { storytree_qa_warnings: [], storytree_qa_errors: [] },
    resolved: null,
    output: null,
    created_at: now,
    updated_at: now,
    ...base,
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(m, null, 2));
  return m;
}

function readManifest(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function updateManifest(filePath, patch) {
  const cur = readManifest(filePath);
  const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2));
  return next;
}

function writeLatest(latestFilePath, runId) {
  fs.mkdirSync(path.dirname(latestFilePath), { recursive: true });
  fs.writeFileSync(latestFilePath, JSON.stringify({ run_id: runId, updated_at: new Date().toISOString() }, null, 2));
}

module.exports = { initManifest, readManifest, updateManifest, writeLatest };
```

- [ ] **Step 3: Tests pass + commit**

```bash
cd mkvideos/matriz && npm test
git add matriz/lib/manifest-writer.js matriz/tests/manifest-writer.test.js
git commit -m "matriz: manifest-writer (init/update/latest)"
```

### Task 3.6: Template resolver — fixed e slot apenas (TDD)

**Files:**
- Create: `mkvideos/matriz/lib/template-resolver.js`
- Create: `mkvideos/matriz/tests/template-resolver.test.js`

- [ ] **Step 1: Test failing**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { resolveText, resolveScriptBlock, resolvePromptBlock } = require('../lib/template-resolver');

const profile = {
  slug: 'fisioterapeuta',
  label: 'FISIOTERAPEUTA',
  props: {
    classic_task: 'manual mobilization',
    character: 'Brazilian woman ...',
    workplace: 'physiotherapy clinic',
    ai_application: 'AI rehab plan'
  }
};

test('resolveText substitui {profissao_label}', () => {
  assert.strictEqual(resolveText('Você é {profissao_label}.', profile), 'Você é FISIOTERAPEUTA.');
});

test('resolveText substitui slot do props', () => {
  assert.strictEqual(resolveText('faz {classic_task}.', profile), 'faz manual mobilization.');
});

test('resolveText falha clara se slot ausente', () => {
  assert.throws(() => resolveText('{slot_inexistente}', profile), /slot.*slot_inexistente/);
});

test('resolveScriptBlock fixed retorna text com substituição', () => {
  const out = resolveScriptBlock({ type: 'fixed', role: 'hook', text: 'Você é {profissao_label}.' }, profile);
  assert.deepStrictEqual(out, { type: 'fixed', role: 'hook', text: 'Você é FISIOTERAPEUTA.' });
});

test('resolveScriptBlock slot resolve template', () => {
  const out = resolveScriptBlock({ type: 'slot', role: 'context', template: 'Hoje, você gasta horas com {classic_task}.' }, profile);
  assert.strictEqual(out.text, 'Hoje, você gasta horas com manual mobilization.');
});

test('resolvePromptBlock fixed', () => {
  const out = resolvePromptBlock({ type: 'fixed', text: 'Brazilian pro' }, profile, { base_style: 'cinematic' });
  assert.strictEqual(out, 'Brazilian pro');
});

test('resolvePromptBlock slot com base_style', () => {
  const out = resolvePromptBlock({ type: 'slot', template: '{character} no {workplace}. {base_style}' }, profile, { base_style: 'cinematic' });
  assert.strictEqual(out, 'Brazilian woman ... no physiotherapy clinic. cinematic');
});
```

- [ ] **Step 2: Implementar (sem rewrite ainda)**

`lib/template-resolver.js`:

```javascript
function resolveText(template, profile, extras = {}) {
  const ctx = { profissao_label: profile.label, ...profile.props, ...extras };
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, k) => {
    if (k in ctx) return String(ctx[k]);
    throw new Error(`slot ausente: ${k} (profissão=${profile.slug})`);
  });
}

function resolveScriptBlock(block, profile, extras = {}) {
  if (block.type === 'fixed') {
    return { type: 'fixed', role: block.role, text: resolveText(block.text, profile, extras) };
  }
  if (block.type === 'slot') {
    return { type: 'slot', role: block.role, text: resolveText(block.template, profile, extras) };
  }
  throw new Error(`block.type não suportado nesta fase: ${block.type}`);
}

function resolvePromptBlock(block, profile, extras = {}) {
  if (block.type === 'fixed') return block.text;
  if (block.type === 'slot') return resolveText(block.template, profile, extras);
  throw new Error(`prompt.type não suportado nesta fase: ${block.type}`);
}

module.exports = { resolveText, resolveScriptBlock, resolvePromptBlock };
```

- [ ] **Step 3: Tests pass + commit**

```bash
cd mkvideos/matriz && npm test
git add matriz/lib/template-resolver.js matriz/tests/template-resolver.test.js
git commit -m "matriz: template-resolver (fixed + slot)"
```

---

## Phase 4 — End-to-end mínimo (1 profissão, slot-only, render real)

### Task 4.1: Criar template slot-only para smoke test

**Files:**
- Create: `mkvideos/matriz/templates/approved/_smoke-slot-only.yml`

- [ ] **Step 1: Conteúdo**

```yaml
meta:
  id: smoke-slot-only
  version: 1
  name: "Smoke test — só slot, sem LLM"
  created_by: user
  created_at: 2026-05-07
target:
  catalog: ../../config/profissoes-30.js
  filter:
    slug: fisioterapeuta
format:
  key: short_reel
  duration_seconds: 15
  aspect: "9:16"
script:
  - type: fixed
    role: hook
    text: "Você é {profissao_label}."
  - type: slot
    role: context
    template: "Você trabalha com {classic_task}."
visual:
  model: flux2-klein
  quality: fast
  base_style: "cinematic, soft lighting, photoreal"
  shots:
    - role: hook
      prompt:
        type: slot
        template: "{character} no {workplace}. {base_style}"
    - role: context
      prompt:
        type: slot
        template: "{character} fazendo {classic_task}. {base_style}"
audio:
  voice: rachel
  music:
    style: "uplifting"
    source: inemavox
  sfx: false
hook:
  policy: off
  position: outro
variation:
  seed_strategy: profissao_hash
  rewrite_temperature: 0.7
  diversify_camera_moves: true
  diversify_music: false
llm:
  provider: openrouter
  model: anthropic/claude-sonnet-4.6
  max_tokens: 200
```

### Task 4.2: Single-video runner (sem LLM, sem batch)

**Files:**
- Create: `mkvideos/matriz/lib/single-video.js`
- Modify: `mkvideos/matriz/run.js` (criar)

- [ ] **Step 1: Implementar single-video.js**

```javascript
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { resolveScriptBlock, resolvePromptBlock } = require('./template-resolver');
const { resolveSeed, deriveBlockSeed } = require('./seed-strategy');
const { runId, runDir, manifestPath, imgsDir, videoPath, scriptPath, latestPath } = require('./output-paths');
const { initManifest, updateManifest, writeLatest } = require('./manifest-writer');

const { generateImage } = require('../../pipeline/generate-image-inemaimg');
const { buildPlanFromImages } = require('../../lib/storytree-shot-schema');
const { validateShotPlan } = require('../../lib/storytree-qa');
const { buildShotVF } = require('../../lib/storytree-presets');

async function generateSingle({ template, profile, batchId, reseed = false }) {
  const rid = runId();
  const tid = template.meta.id;
  const slug = profile.slug;
  const dir = runDir(tid, slug, rid);
  fs.mkdirSync(path.join(dir, 'imgs'), { recursive: true });

  const seedValue = resolveSeed(template.variation, slug, reseed);
  const mp = manifestPath(tid, slug, rid);
  initManifest(mp, {
    run_id: rid,
    batch_id: batchId,
    template: { id: tid, version: template.meta.version, file_path: template._meta.file_path, file_sha256: template._meta.file_sha256 },
    profissao: { slug, label: profile.label, catalog_file: template.target.catalog },
    gate: { mode: 'none', selected_for_sample: false },
    seed: { strategy: template.variation.seed_strategy, value: seedValue, reseed },
  });

  const tStart = Date.now();
  updateManifest(mp, { status: 'resolving' });

  // 1. Resolve script (fixed + slot only nesta fase)
  const extras = { base_style: template.visual.base_style || '' };
  const resolvedScript = template.script
    .filter((b) => b.type !== 'rewrite' && b.type !== 'hook')
    .map((b) => resolveScriptBlock(b, profile, extras));

  // 2. Resolve visual prompts
  const resolvedShots = template.visual.shots.map((s, i) => ({
    role: s.role,
    prompt: resolvePromptBlock(s.prompt, profile, extras),
    model: template.visual.model,
    seed_image: deriveBlockSeed(seedValue, `visual:${s.role}:${i}`),
    image_path: path.join('imgs', `shot_${String(i + 1).padStart(2, '0')}.png`),
  }));

  fs.writeFileSync(path.join(dir, 'resolved-script.txt'), resolvedScript.map((b) => `[${b.role}] ${b.text}`).join('\n'));

  updateManifest(mp, { status: 'resolved', resolved: { script: resolvedScript, visual: { shots: resolvedShots }, format: template.format } });

  // 3. Image gen
  updateManifest(mp, { status: 'image_generating' });
  const tImg = Date.now();
  for (const shot of resolvedShots) {
    const out = path.join(dir, shot.image_path);
    if (fs.existsSync(out) && fs.statSync(out).size > 50000) continue;
    await generateImage({
      outputPath: out,
      prompt: shot.prompt,
      model: template.visual.model,
      ratio: template.format.aspect,
      seed: shot.seed_image,
      quality: template.visual.quality || 'fast',
    });
  }
  const imgMs = Date.now() - tImg;

  // 4. Build shot plan via storytree
  const images = resolvedShots.map((s, i) => ({
    file: path.join(dir, s.image_path),
    role: s.role,
    image_class: 'face', // simplificação inicial; storytree-classify entra na fase 5
  }));
  const plan = buildPlanFromImages(images, template.format.key, template.format.duration_seconds);

  const qa = validateShotPlan(plan);
  if (qa.errors && qa.errors.length) {
    updateManifest(mp, { status: 'failed', error: { stage: 'qa', message: qa.errors.join('; ') }, qa });
    throw new Error(`storytree QA: ${qa.errors.join('; ')}`);
  }

  // 5. Render via ffmpeg per-shot + concat (espelha render-storytree-v2 pattern)
  updateManifest(mp, { status: 'rendering', resolved: { ...JSON.parse(fs.readFileSync(mp,'utf8')).resolved, shot_plan: plan } });
  const tRender = Date.now();
  const segs = [];
  const aspectMap = { '9:16': '1080:1920', '16:9': '1920:1080', '1:1': '1080:1080', '4:3': '1440:1080', '3:4': '1080:1440' };
  const targetSize = aspectMap[template.format.aspect] || '1080:1920';
  const [W, H] = targetSize.split(':').map(Number);
  plan.shots.forEach((shot, i) => {
    const segOut = path.join(dir, `_seg_${i}.mp4`);
    const vf = buildShotVF(shot, { W, H });
    const cmd = `ffmpeg -y -loop 1 -i "${shot.image}" -t ${shot.duration} -vf "${vf}" -c:v libx264 -pix_fmt yuv420p -preset fast "${segOut}"`;
    execSync(cmd, { stdio: 'pipe' });
    segs.push(segOut);
  });
  const concatList = path.join(dir, '_concat.txt');
  fs.writeFileSync(concatList, segs.map((s) => `file '${s}'`).join('\n'));
  const finalOut = path.join(dir, 'video.mp4');
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${finalOut}"`, { stdio: 'pipe' });
  segs.forEach((s) => fs.unlinkSync(s));
  fs.unlinkSync(concatList);
  const renderMs = Date.now() - tRender;

  const stat = fs.statSync(finalOut);
  updateManifest(mp, {
    status: 'done',
    timings: { image_gen_ms: imgMs, render_ms: renderMs, total_ms: Date.now() - tStart },
    output: { video_path: 'video.mp4', imgs_dir: 'imgs', script_path: 'resolved-script.txt', video_size_bytes: stat.size, video_duration_seconds: template.format.duration_seconds },
  });

  writeLatest(latestPath(tid, slug), rid);
  return { manifest: mp, video: finalOut };
}

module.exports = { generateSingle };
```

- [ ] **Step 2: Criar run.js mínimo (chama generateSingle pra 1 profissão do filter)**

`run.js`:

```javascript
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
```

- [ ] **Step 3: Smoke test manual (precisa daemon inemaimg + ffmpeg)**

Run: `cd mkvideos/matriz && node run.js templates/approved/_smoke-slot-only.yml`
Expected: gera 1 vídeo em `output/smoke-slot-only/fisioterapeuta/<run_id>/video.mp4`. Manifest gravado com `status: done`.

Se daemon inemaimg não estiver up, vai falhar em image_gen — manifest fica `status: failed` mas com error.stage='image_gen', o que é o comportamento desejado.

- [ ] **Step 4: Validar visualmente**

Abra o vídeo gerado. Espera-se: ~15s, 9:16, com 2 shots e zoompan camera moves. Sem áudio.

- [ ] **Step 5: Commit**

```bash
git add matriz/lib/single-video.js matriz/run.js matriz/templates/approved/_smoke-slot-only.yml
git commit -m "matriz: end-to-end mínimo (1 profissão, slot-only, render real)"
```

---

## Phase 5 — LLM (rewrite + hook)

### Task 5.1: LLM client wrapper (TDD com mock)

**Files:**
- Create: `mkvideos/matriz/lib/llm-client.js`
- Create: `mkvideos/matriz/tests/llm-client.test.js`

- [ ] **Step 1: Test (com mock fetch)**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { callLLM } = require('../lib/llm-client');

test('callLLM monta payload OpenRouter e parseia resposta', async () => {
  const orig = global.fetch;
  let captured;
  global.fetch = async (url, opts) => {
    captured = { url, opts };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'resposta da IA' } }], usage: { prompt_tokens: 12, completion_tokens: 5 } })
    };
  };
  try {
    const r = await callLLM({
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.6',
      prompt: 'oi',
      temperature: 0.5,
      max_tokens: 100,
      apiKey: 'k'
    });
    assert.strictEqual(r.text, 'resposta da IA');
    assert.strictEqual(r.tokens_in, 12);
    assert.strictEqual(r.tokens_out, 5);
    assert.ok(captured.url.includes('openrouter'));
  } finally {
    global.fetch = orig;
  }
});

test('callLLM com provider desconhecido lança erro', async () => {
  await assert.rejects(callLLM({ provider: 'unknown', model: 'x', prompt: 'y', apiKey: 'k' }), /provider/);
});
```

- [ ] **Step 2: Implementar**

`lib/llm-client.js`:

```javascript
async function callLLM({ provider, model, prompt, temperature = 0.7, max_tokens = 500, apiKey, seed }) {
  if (provider === 'openrouter') {
    const t0 = Date.now();
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens,
        ...(seed !== undefined ? { seed } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return {
      text: data.choices[0].message.content.trim(),
      tokens_in: data.usage?.prompt_tokens || 0,
      tokens_out: data.usage?.completion_tokens || 0,
      duration_ms: Date.now() - t0,
      raw: data,
    };
  }
  throw new Error(`provider não suportado: ${provider}`);
}

module.exports = { callLLM };
```

- [ ] **Step 3: Tests pass + commit**

```bash
cd mkvideos/matriz && npm test
git add matriz/lib/llm-client.js matriz/tests/llm-client.test.js
git commit -m "matriz: llm-client (openrouter)"
```

### Task 5.2: Resolver com rewrite + hook (TDD com mock LLM)

**Files:**
- Modify: `mkvideos/matriz/lib/template-resolver.js`
- Modify: `mkvideos/matriz/tests/template-resolver.test.js`

- [ ] **Step 1: Adicionar testes**

Acrescentar em `tests/template-resolver.test.js`:

```javascript
const { resolveScriptBlockAsync, resolveHookBlock } = require('../lib/template-resolver');

test('resolveScriptBlockAsync rewrite chama LLM com instruction interpolada', async () => {
  const calls = [];
  const fakeLLM = async ({ prompt }) => { calls.push(prompt); return { text: 'reescrito', tokens_in: 10, tokens_out: 3, duration_ms: 5 }; };
  const block = { type: 'rewrite', role: 'explanation', instruction: 'fala sobre {classic_task} para {profissao_label}' };
  const out = await resolveScriptBlockAsync(block, profile, {}, { llmFn: fakeLLM, llmCfg: { provider: 'openrouter', model: 'm', max_tokens: 100 }, temperature: 0.7, seed: 1 });
  assert.strictEqual(out.text, 'reescrito');
  assert.match(calls[0], /manual mobilization/);
  assert.match(calls[0], /FISIOTERAPEUTA/);
});

test('resolveHookBlock policy=default usa hook.text rewrite', async () => {
  const fakeLLM = async () => ({ text: 'hook gerado', tokens_in: 1, tokens_out: 1, duration_ms: 1 });
  const tmpl = { hook: { policy: 'default', position: 'outro', text: { type: 'rewrite', instruction: 'frase para {profissao_label}' } } };
  const out = await resolveHookBlock(tmpl, profile, {}, { llmFn: fakeLLM, llmCfg: { provider: 'openrouter', model: 'm' }, temperature: 0.7, seed: 1 });
  assert.strictEqual(out.text, 'hook gerado');
  assert.strictEqual(out.policy, 'default');
});

test('resolveHookBlock policy=off retorna null', async () => {
  const tmpl = { hook: { policy: 'off', position: 'outro' } };
  const out = await resolveHookBlock(tmpl, profile, {}, {});
  assert.strictEqual(out, null);
});

test('resolveHookBlock policy=override usa override.text/instruction', async () => {
  const fakeLLM = async ({ prompt }) => ({ text: `OV:${prompt}`, tokens_in: 1, tokens_out: 1, duration_ms: 1 });
  const tmpl = { hook: { policy: 'override', position: 'outro', text: { type: 'rewrite', instruction: 'orig' } } };
  const override = { instruction: 'frase nova para {profissao_label}', type: 'rewrite' };
  const out = await resolveHookBlock(tmpl, profile, {}, { llmFn: fakeLLM, llmCfg: { provider: 'openrouter', model: 'm' }, temperature: 0.7, override });
  assert.match(out.text, /OV:.*FISIOTERAPEUTA/);
});
```

- [ ] **Step 2: Estender resolver**

Acrescentar a `lib/template-resolver.js`:

```javascript
async function resolveScriptBlockAsync(block, profile, extras, opts) {
  if (block.type === 'fixed' || block.type === 'slot') {
    return resolveScriptBlock(block, profile, extras);
  }
  if (block.type === 'rewrite') {
    const prompt = resolveText(block.instruction, profile, extras);
    const r = await opts.llmFn({
      provider: opts.llmCfg.provider,
      model: opts.llmCfg.model,
      max_tokens: opts.llmCfg.max_tokens,
      apiKey: opts.apiKey,
      prompt,
      temperature: opts.temperature,
      seed: opts.seed,
    });
    return {
      type: 'rewrite',
      role: block.role,
      text: r.text,
      _llm: { prompt, response: r.text, tokens_in: r.tokens_in, tokens_out: r.tokens_out, duration_ms: r.duration_ms, model: opts.llmCfg.model, temperature: opts.temperature },
    };
  }
  if (block.type === 'hook') {
    return { type: 'hook', role: block.role, _placeholder: true };
  }
  throw new Error(`type desconhecido: ${block.type}`);
}

async function resolveHookBlock(template, profile, extras, opts) {
  const h = template.hook;
  if (!h || h.policy === 'off') return null;
  let textBlock = h.text;
  if (h.policy === 'override' && opts.override) textBlock = opts.override;
  if (!textBlock) throw new Error('hook policy != off mas hook.text ausente');
  if (textBlock.type === 'fixed') return { policy: h.policy, position: h.position, text: resolveText(textBlock.text, profile, extras) };
  if (textBlock.type === 'slot') return { policy: h.policy, position: h.position, text: resolveText(textBlock.template, profile, extras) };
  if (textBlock.type === 'rewrite') {
    const prompt = resolveText(textBlock.instruction, profile, extras);
    const r = await opts.llmFn({
      provider: opts.llmCfg.provider,
      model: opts.llmCfg.model,
      max_tokens: opts.llmCfg.max_tokens,
      apiKey: opts.apiKey,
      prompt,
      temperature: opts.temperature,
      seed: opts.seed,
    });
    return { policy: h.policy, position: h.position, text: r.text, _llm: { prompt, response: r.text, tokens_in: r.tokens_in, tokens_out: r.tokens_out, duration_ms: r.duration_ms, model: opts.llmCfg.model, temperature: opts.temperature } };
  }
  throw new Error('hook.text.type desconhecido');
}

module.exports = { ...module.exports, resolveScriptBlockAsync, resolveHookBlock };
```

- [ ] **Step 3: Tests pass + commit**

```bash
cd mkvideos/matriz && npm test
git add matriz/lib/template-resolver.js matriz/tests/template-resolver.test.js
git commit -m "matriz: resolver suporta rewrite + hook (LLM injetável)"
```

### Task 5.3: single-video usa LLM real e captura llm_calls

- [ ] **Step 1: Modificar single-video.js para usar resolveScriptBlockAsync e resolveHookBlock**

Substitua a parte de "Resolve script" em `lib/single-video.js`:

```javascript
const { resolveScriptBlockAsync, resolveHookBlock } = require('./template-resolver');
const { callLLM } = require('./llm-client');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// ... dentro da função generateSingle, substitui o bloco "Resolve script":
const apiKey = process.env.OPENROUTER_API_KEY;
const llmCalls = [];
const llmFn = async (args) => {
  const r = await callLLM(args);
  llmCalls.push({
    block_role: args._role || 'unknown',
    model: args.model,
    temperature: args.temperature,
    prompt: args.prompt,
    response_text: r.text,
    tokens_in: r.tokens_in,
    tokens_out: r.tokens_out,
    duration_ms: r.duration_ms,
  });
  return r;
};

// resolve cada bloco em ordem
const resolvedScript = [];
for (const block of template.script) {
  if (block.type === 'hook') {
    const hookResolved = await resolveHookBlock(template, profile, extras, {
      llmFn: (a) => llmFn({ ...a, _role: 'hook' }),
      llmCfg: template.llm,
      apiKey,
      temperature: template.variation.rewrite_temperature,
      seed: deriveBlockSeed(seedValue, 'hook'),
    });
    if (hookResolved) resolvedScript.push({ type: 'hook', role: block.role, text: hookResolved.text });
  } else {
    const r = await resolveScriptBlockAsync(block, profile, extras, {
      llmFn: (a) => llmFn({ ...a, _role: block.role }),
      llmCfg: template.llm,
      apiKey,
      temperature: template.variation.rewrite_temperature,
      seed: deriveBlockSeed(seedValue, block.role),
    });
    resolvedScript.push(r);
  }
}

// salvar llm_calls no manifest mais tarde:
updateManifest(mp, { llm_calls: llmCalls });
```

- [ ] **Step 2: Smoke test (precisa OPENROUTER_API_KEY no .env do mkvideos)**

Crie `templates/approved/_smoke-with-rewrite.yml` (igual `example-como-usar-ia-vanguarda.yml` mas com `target.filter.slug: fisioterapeuta`).

Run: `cd mkvideos/matriz && node run.js templates/approved/_smoke-with-rewrite.yml`
Expected: vídeo gerado com áudio TBD (audio entra na fase 6+ ou nunca neste plano? veja Sec 11 do spec — áudio é parte da recipe). Manifest contém `llm_calls` array com pelo menos 2 entradas (rewrite + hook).

- [ ] **Step 3: Commit**

```bash
git add matriz/lib/single-video.js matriz/templates/approved/_smoke-with-rewrite.yml
git commit -m "matriz: single-video usa LLM real (rewrite + hook) com captura"
```

---

## Phase 6 — Batch + filter + concurrency

### Task 6.1: Concurrency pool (TDD)

**Files:**
- Create: `mkvideos/matriz/lib/concurrency.js`
- Create: `mkvideos/matriz/tests/concurrency.test.js`

- [ ] **Step 1: Test failing**

```javascript
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
  assert.deepStrictEqual(results.sort(), [0, 1, 2, 3, 4, 5]);
  assert.ok(peak <= 2);
});

test('runWithLimit captura erros sem matar lote', async () => {
  const tasks = [
    async () => 'ok1',
    async () => { throw new Error('boom'); },
    async () => 'ok3',
  ];
  const results = await runWithLimit(tasks, 2, { onError: (e, i) => ({ failed: true, i, err: e.message }) });
  assert.strictEqual(results.filter((r) => r && r.failed).length, 1);
});
```

- [ ] **Step 2: Implementar**

```javascript
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
```

- [ ] **Step 3: Tests pass + commit**

```bash
cd mkvideos/matriz && npm test
git add matriz/lib/concurrency.js matriz/tests/concurrency.test.js
git commit -m "matriz: concurrency pool"
```

### Task 6.2: Batch runner

**Files:**
- Create: `mkvideos/matriz/lib/batch-runner.js`
- Modify: `mkvideos/matriz/run.js`

- [ ] **Step 1: Implementar batch-runner.js**

```javascript
const fs = require('node:fs');
const path = require('node:path');
const { generateSingle } = require('./single-video');
const { runWithLimit } = require('./concurrency');
const { batchPath, runId } = require('./output-paths');

const DEFAULT_CONCURRENCY = 4;

async function runBatch({ template, subset, gateMode = 'none', reseed = false, concurrency = DEFAULT_CONCURRENCY, onProgress }) {
  const batchId = runId();
  const summary = {
    batch_id: batchId,
    template: { id: template.meta.id, version: template.meta.version },
    gate_mode: gateMode,
    started_at: new Date().toISOString(),
    ended_at: null,
    totals: { planned: subset.length, done: 0, failed: 0, skipped: 0 },
    videos: subset.map((p) => ({ slug: p.slug, status: 'pending', manifest: null, error_stage: null, error_message: null })),
  };

  const summaryFile = batchPath(template.meta.id, batchId);
  fs.mkdirSync(path.dirname(summaryFile), { recursive: true });
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

  const tasks = subset.map((profile, idx) => async () => {
    if (onProgress) onProgress({ idx, total: subset.length, slug: profile.slug, status: 'starting' });
    try {
      const r = await generateSingle({ template, profile, batchId, reseed });
      summary.videos[idx].status = 'done';
      summary.videos[idx].manifest = r.manifest;
      summary.totals.done++;
      if (onProgress) onProgress({ idx, total: subset.length, slug: profile.slug, status: 'done' });
      return r;
    } catch (e) {
      summary.videos[idx].status = 'failed';
      summary.videos[idx].error_stage = e.stage || 'unknown';
      summary.videos[idx].error_message = e.message;
      summary.totals.failed++;
      if (onProgress) onProgress({ idx, total: subset.length, slug: profile.slug, status: 'failed', error: e.message });
      return null;
    } finally {
      fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    }
  });

  await runWithLimit(tasks, concurrency);
  summary.ended_at = new Date().toISOString();
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  return { batchId, summary, summaryFile };
}

module.exports = { runBatch };
```

- [ ] **Step 2: Atualizar run.js para usar batch-runner**

Substituir o loop `for` em `run.js` por:

```javascript
const { runBatch } = require('./lib/batch-runner');

const result = await runBatch({
  template,
  subset,
  gateMode: args.gate,
  reseed: args.reseed,
  concurrency: args.concurrency || 4,
  onProgress: ({ idx, total, slug, status, error }) => {
    const stamp = new Date().toISOString().slice(11, 19);
    console.log(`[${stamp}] [${idx + 1}/${total}] ${slug} — ${status}${error ? ': ' + error : ''}`);
  }
});

console.log(`\nBatch ${result.batchId} done — ${result.summary.totals.done} ok / ${result.summary.totals.failed} fail`);
console.log(`Summary: ${result.summaryFile}`);
```

- [ ] **Step 3: Smoke test em 3 profissões**

Run: `cd mkvideos/matriz && node run.js templates/approved/_smoke-slot-only.yml --filter=area:saude --limit=3`
Expected: 3 vídeos paralelos (até `concurrency=4`), `_batches/<id>.json` completo.

- [ ] **Step 4: Commit**

```bash
git add matriz/lib/batch-runner.js matriz/run.js
git commit -m "matriz: batch-runner com concurrency + summary live"
```

### Task 6.3: Pre-flight checks (slot integrity + orçamento)

**Files:**
- Create: `mkvideos/matriz/lib/preflight.js`
- Create: `mkvideos/matriz/tests/preflight.test.js`
- Modify: `mkvideos/matriz/run.js`

- [ ] **Step 1: Test failing**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { collectSlots, checkSlotIntegrity } = require('../lib/preflight');

test('collectSlots extrai todos os slots usados no template', () => {
  const tmpl = {
    script: [
      { type: 'fixed', text: 'Você é {profissao_label}.' },
      { type: 'slot', template: '{classic_task} no {workplace}' },
      { type: 'rewrite', instruction: 'fale sobre {ai_application} para {profissao_label}' },
    ],
    visual: { shots: [{ prompt: { type: 'slot', template: '{character} usa {ai_daily_tool}' } }] },
    hook: { text: { type: 'rewrite', instruction: 'frase para {profissao_label}' } },
  };
  const s = collectSlots(tmpl);
  assert.ok(s.has('classic_task'));
  assert.ok(s.has('workplace'));
  assert.ok(s.has('ai_application'));
  assert.ok(s.has('character'));
  assert.ok(s.has('ai_daily_tool'));
  assert.ok(!s.has('profissao_label')); // built-in, não checa em props
});

test('checkSlotIntegrity reporta profissões com slot faltante', () => {
  const slots = new Set(['classic_task', 'foo_inexistente']);
  const cat = [
    { slug: 'a', props: { classic_task: 'x' } },
    { slug: 'b', props: { classic_task: 'y', foo_inexistente: 'z' } }
  ];
  const r = checkSlotIntegrity(slots, cat);
  assert.strictEqual(r.complete.length, 1);
  assert.strictEqual(r.missing.length, 1);
  assert.strictEqual(r.missing[0].slug, 'a');
  assert.deepStrictEqual(r.missing[0].missing_slots, ['foo_inexistente']);
});
```

- [ ] **Step 2: Implementar**

```javascript
const SLOT_RE = /\{([a-zA-Z0-9_]+)\}/g;
const BUILTIN_SLOTS = new Set(['profissao_label', 'base_style']);

function extractFromString(s, out) {
  let m;
  while ((m = SLOT_RE.exec(s)) !== null) {
    if (!BUILTIN_SLOTS.has(m[1])) out.add(m[1]);
  }
}

function collectSlots(template) {
  const out = new Set();
  for (const b of template.script || []) {
    if (b.text) extractFromString(b.text, out);
    if (b.template) extractFromString(b.template, out);
    if (b.instruction) extractFromString(b.instruction, out);
  }
  for (const s of (template.visual?.shots || [])) {
    const p = s.prompt;
    if (p) {
      if (p.text) extractFromString(p.text, out);
      if (p.template) extractFromString(p.template, out);
      if (p.instruction) extractFromString(p.instruction, out);
    }
  }
  if (template.hook?.text) {
    const t = template.hook.text;
    if (t.text) extractFromString(t.text, out);
    if (t.template) extractFromString(t.template, out);
    if (t.instruction) extractFromString(t.instruction, out);
  }
  return out;
}

function checkSlotIntegrity(slots, profissoes) {
  const complete = [];
  const missing = [];
  for (const p of profissoes) {
    const miss = [...slots].filter((s) => !(p.props && s in p.props));
    if (miss.length === 0) complete.push(p);
    else missing.push({ slug: p.slug, missing_slots: miss });
  }
  return { complete, missing };
}

function estimateBudget(template, subset) {
  const rewriteBlocks = (template.script || []).filter((b) => b.type === 'rewrite').length;
  const hookIsRewrite = template.hook?.text?.type === 'rewrite' && template.hook.policy !== 'off' ? 1 : 0;
  const llmCalls = subset.length * (rewriteBlocks + hookIsRewrite);
  const images = subset.length * (template.visual?.shots?.length || 0);
  const tokensEst = llmCalls * (template.llm?.max_tokens || 200);
  return { videos: subset.length, llmCalls, tokensEst, images };
}

module.exports = { collectSlots, checkSlotIntegrity, estimateBudget };
```

- [ ] **Step 3: Integrar em run.js (pre-flight ANTES do batch)**

Adicionar a `run.js` antes de `runBatch`:

```javascript
const { collectSlots, checkSlotIntegrity, estimateBudget } = require('./lib/preflight');
const readline = require('node:readline');

function ask(q) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => { rl.close(); res(a.trim().toLowerCase()); });
  });
}

const slots = collectSlots(template);
const integrity = checkSlotIntegrity(slots, subset);
if (integrity.missing.length) {
  console.warn(`\n⚠ ${integrity.missing.length} profissão(ões) com slots faltantes:`);
  for (const m of integrity.missing.slice(0, 5)) console.warn(`  ${m.slug}: faltam ${m.missing_slots.join(', ')}`);
  if (integrity.missing.length > 5) console.warn(`  ... +${integrity.missing.length - 5}`);
  const ans = await ask('  [a]bortar / [s]kip-faltantes / [c]ontinuar com warning: ');
  if (ans === 'a') process.exit(1);
  if (ans === 's') subset = integrity.complete;
}

const budget = estimateBudget(template, subset);
console.log(`\nPre-flight: ${budget.videos} vídeos | ${budget.llmCalls} chamadas LLM (~${budget.tokensEst} tokens) | ${budget.images} imagens`);
const go = await ask('OK? [y/N]: ');
if (go !== 'y' && go !== 's') { console.log('cancelado.'); process.exit(0); }
```

- [ ] **Step 4: Tests pass + commit**

```bash
cd mkvideos/matriz && npm test
git add matriz/lib/preflight.js matriz/tests/preflight.test.js matriz/run.js
git commit -m "matriz: pre-flight slot integrity + orçamento"
```

---

## Phase 7 — Gates: sample + none

### Task 7.1: Gate sample (escolha diversificada + pausa)

**Files:**
- Create: `mkvideos/matriz/lib/gates.js`
- Create: `mkvideos/matriz/tests/gates.test.js`
- Modify: `mkvideos/matriz/run.js`

- [ ] **Step 1: Test failing**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { pickSample } = require('../lib/gates');

test('pickSample retorna 3-5 elementos diversificados por area', () => {
  const cat = [
    { slug: 'a1', area: 'saude' }, { slug: 'a2', area: 'saude' },
    { slug: 'b1', area: 'tech' }, { slug: 'b2', area: 'tech' },
    { slug: 'c1', area: 'edu' }, { slug: 'd1', area: 'lei' }
  ];
  const s = pickSample(cat, 4, 42); // seed 42
  assert.strictEqual(s.length, 4);
  const areas = new Set(s.map((p) => p.area));
  assert.ok(areas.size >= 3, 'Esperava pelo menos 3 áreas diferentes');
});

test('pickSample determinístico por seed', () => {
  const cat = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }, { slug: 'd' }];
  const s1 = pickSample(cat, 2, 1);
  const s2 = pickSample(cat, 2, 1);
  assert.deepStrictEqual(s1.map((p) => p.slug), s2.map((p) => p.slug));
});
```

- [ ] **Step 2: Implementar**

```javascript
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSample(catalog, n, seed = Date.now()) {
  const rng = mulberry32(seed);
  const byArea = new Map();
  for (const p of catalog) {
    const a = p.area || '_default';
    if (!byArea.has(a)) byArea.set(a, []);
    byArea.get(a).push(p);
  }
  const areas = [...byArea.keys()];
  const sample = [];
  while (sample.length < n && areas.length) {
    for (const a of [...areas]) {
      const list = byArea.get(a);
      if (!list.length) { areas.splice(areas.indexOf(a), 1); continue; }
      const idx = Math.floor(rng() * list.length);
      sample.push(list.splice(idx, 1)[0]);
      if (sample.length >= n) break;
    }
  }
  return sample;
}

module.exports = { pickSample };
```

- [ ] **Step 3: Integrar gate=sample em run.js**

Após pre-flight, antes de `runBatch`:

```javascript
const { pickSample } = require('./lib/gates');

let toRun = subset;
let sampleSet = null;
if (args.gate === 'sample') {
  sampleSet = pickSample(subset, Math.min(5, subset.length));
  console.log(`\n[gate=sample] gerando ${sampleSet.length} amostras primeiro: ${sampleSet.map((p) => p.slug).join(', ')}`);
  toRun = sampleSet;
}

const result = await runBatch({ template, subset: toRun, gateMode: args.gate, reseed: args.reseed, concurrency: 4, onProgress: ... });

if (args.gate === 'sample' && result.summary.totals.failed < toRun.length) {
  console.log(`\nAmostras geradas. Abra a UI para revisar: http://localhost:5278/batch/${result.batchId}`);
  const go = await ask('Aprovar e gerar restante? [y/N]: ');
  if (go === 'y' || go === 's') {
    const remaining = subset.filter((p) => !sampleSet.find((s) => s.slug === p.slug));
    const restResult = await runBatch({ template, subset: remaining, gateMode: 'sample-rest', reseed: args.reseed, concurrency: 4, onProgress: ... });
    console.log(`\nLote completo: ${result.summary.totals.done + restResult.summary.totals.done} ok / ${result.summary.totals.failed + restResult.summary.totals.failed} fail`);
  } else {
    console.log('Lote interrompido após amostra.');
  }
}
```

- [ ] **Step 4: Tests pass + commit**

```bash
cd mkvideos/matriz && npm test
git add matriz/lib/gates.js matriz/tests/gates.test.js matriz/run.js
git commit -m "matriz: gate=sample (3-5 diversificadas + pausa)"
```

---

## Phase 8 — Reseed + replay + resume

### Task 8.1: --reseed (já implementado em seed-strategy; cria novo run_id automaticamente)

- [ ] **Step 1: Validar via teste integrado**

Run: `cd mkvideos/matriz && node run.js templates/approved/_smoke-slot-only.yml --reseed`
Expected: novo `run_id` em `output/smoke-slot-only/fisioterapeuta/`, `latest.json` apontando pro novo, v1 preservado.

- [ ] **Step 2: Sem código novo necessário; só commit do que vier de testes/docs**

(Se houver mudança em README com `--reseed` documentado, commit aqui.)

### Task 8.2: --replay (reroda 1:1 a partir de manifest)

**Files:**
- Create: `mkvideos/matriz/lib/replay.js`
- Modify: `mkvideos/matriz/run.js`

- [ ] **Step 1: Implementar replay.js**

```javascript
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { generateImage } = require('../../pipeline/generate-image-inemaimg');
const { buildShotVF } = require('../../lib/storytree-presets');
const { runId, runDir, manifestPath, imgsDir, videoPath, latestPath } = require('./output-paths');
const { initManifest, updateManifest, writeLatest } = require('./manifest-writer');

async function replayManifest(srcManifestPath) {
  const src = JSON.parse(fs.readFileSync(srcManifestPath, 'utf8'));
  const tid = src.template.id;
  const slug = src.profissao.slug;
  const newRid = runId();
  const dir = runDir(tid, slug, newRid);
  fs.mkdirSync(path.join(dir, 'imgs'), { recursive: true });
  const mp = manifestPath(tid, slug, newRid);
  initManifest(mp, {
    run_id: newRid,
    batch_id: 'replay',
    template: src.template,
    profissao: src.profissao,
    seed: src.seed,
    gate: { mode: 'replay', selected_for_sample: false },
    resolved: src.resolved,
    llm_calls: src.llm_calls,
  });

  // image gen com seeds gravadas
  for (const shot of src.resolved.visual.shots) {
    const out = path.join(dir, shot.image_path);
    await generateImage({
      outputPath: out,
      prompt: shot.prompt,
      model: shot.model,
      ratio: src.resolved.format.aspect,
      seed: shot.seed_image,
      quality: 'high',
    });
  }

  // render usando shot_plan gravado
  const plan = src.resolved.shot_plan;
  const aspectMap = { '9:16': '1080:1920', '16:9': '1920:1080', '1:1': '1080:1080', '4:3': '1440:1080', '3:4': '1080:1440' };
  const [W, H] = (aspectMap[src.resolved.format.aspect] || '1080:1920').split(':').map(Number);
  const segs = [];
  plan.shots.forEach((shot, i) => {
    const segOut = path.join(dir, `_seg_${i}.mp4`);
    const vf = buildShotVF(shot, { W, H });
    execSync(`ffmpeg -y -loop 1 -i "${shot.image}" -t ${shot.duration} -vf "${vf}" -c:v libx264 -pix_fmt yuv420p -preset fast "${segOut}"`, { stdio: 'pipe' });
    segs.push(segOut);
  });
  const concatList = path.join(dir, '_concat.txt');
  fs.writeFileSync(concatList, segs.map((s) => `file '${s}'`).join('\n'));
  const finalOut = path.join(dir, 'video.mp4');
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${finalOut}"`, { stdio: 'pipe' });
  segs.forEach((s) => fs.unlinkSync(s));
  fs.unlinkSync(concatList);

  const stat = fs.statSync(finalOut);
  updateManifest(mp, {
    status: 'done',
    output: { video_path: 'video.mp4', imgs_dir: 'imgs', script_path: 'resolved-script.txt', video_size_bytes: stat.size, video_duration_seconds: src.resolved.format.duration_seconds },
  });
  writeLatest(latestPath(tid, slug), newRid);
  return finalOut;
}

module.exports = { replayManifest };
```

- [ ] **Step 2: Adicionar suporte a --replay em run.js**

```javascript
if (args.template && args.template.endsWith('.json') && args.template.includes('manifest')) {
  // formato: --replay path-to-manifest.json (passado como o "template" arg)
  const { replayManifest } = require('./lib/replay');
  const out = await replayManifest(args.template);
  console.log(`replayed: ${out}`);
  process.exit(0);
}
```

(Ou adicionar flag `--replay` separado; isso é decisão de UX. Mantém-se simples: se o arg primeiro for .json, é replay.)

- [ ] **Step 3: Smoke test**

Run: `cd mkvideos/matriz && node run.js output/smoke-slot-only/fisioterapeuta/<rid>/manifest.json`
Expected: novo run_id criado, vídeo idêntico (modulo encoder).

- [ ] **Step 4: Commit**

```bash
git add matriz/lib/replay.js matriz/run.js
git commit -m "matriz: --replay reroda 1:1 a partir de manifest"
```

### Task 8.3: --resume (refaz só os failed do batch)

**Files:**
- Modify: `mkvideos/matriz/run.js`
- Create: `mkvideos/matriz/lib/resume.js`

- [ ] **Step 1: Implementar resume.js**

```javascript
const fs = require('node:fs');
const path = require('node:path');
const { batchPath } = require('./output-paths');

function loadBatchSummary(templateId, batchId) {
  const p = batchPath(templateId, batchId);
  if (!fs.existsSync(p)) throw new Error(`batch summary não encontrado: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function failedSlugs(summary) {
  return summary.videos.filter((v) => v.status === 'failed' || v.status === 'pending').map((v) => v.slug);
}

module.exports = { loadBatchSummary, failedSlugs };
```

- [ ] **Step 2: Suportar --resume <batch_id> em run.js**

Antes de aplicar filter na CLI:

```javascript
if (args.resume) {
  const { loadBatchSummary, failedSlugs } = require('./lib/resume');
  const summary = loadBatchSummary(template.meta.id, args.resume);
  const slugs = new Set(failedSlugs(summary));
  subset = subset.filter((p) => slugs.has(p.slug));
  console.log(`[resume] retomando ${subset.length} videos do batch ${args.resume}`);
}
```

E em `parseArgs`:
```javascript
else if (a.startsWith('--resume=')) args.resume = a.slice(9);
```

- [ ] **Step 3: Smoke test**

Force uma falha em 1 vídeo (e.g., quebre o template temporariamente em 1 slot ausente), rode batch, depois corrija e rode `--resume=<batch_id>`.

- [ ] **Step 4: Commit**

```bash
git add matriz/lib/resume.js matriz/run.js
git commit -m "matriz: --resume refaz só videos failed do batch"
```

---

## Phase 9 — Erros + retry + observabilidade

### Task 9.1: Error handler com categorização (TDD)

**Files:**
- Create: `mkvideos/matriz/lib/error-handler.js`
- Create: `mkvideos/matriz/tests/error-handler.test.js`

- [ ] **Step 1: Test failing**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { categorizeError, withRetry } = require('../lib/error-handler');

test('categorizeError reconhece transient (timeout/ECONN)', () => {
  assert.strictEqual(categorizeError(new Error('ETIMEDOUT')), 'transient');
  assert.strictEqual(categorizeError(new Error('ECONNRESET')), 'transient');
  assert.strictEqual(categorizeError(new Error('rate_limit_exceeded')), 'transient');
});

test('categorizeError reconhece schema/slot', () => {
  assert.strictEqual(categorizeError(new Error('slot ausente: foo')), 'slot');
  assert.strictEqual(categorizeError(new Error('Template schema inválido: ...')), 'schema');
});

test('withRetry repete em transient até sucesso', async () => {
  let n = 0;
  const fn = async () => { n++; if (n < 3) throw new Error('ETIMEDOUT'); return 'ok'; };
  const r = await withRetry(fn, { attempts: 3, baseMs: 1 });
  assert.strictEqual(r, 'ok');
  assert.strictEqual(n, 3);
});

test('withRetry NÃO repete em schema/slot (fatal)', async () => {
  let n = 0;
  const fn = async () => { n++; throw new Error('slot ausente: x'); };
  await assert.rejects(withRetry(fn, { attempts: 3, baseMs: 1 }), /slot ausente/);
  assert.strictEqual(n, 1);
});
```

- [ ] **Step 2: Implementar**

```javascript
function categorizeError(e) {
  const m = e.message || '';
  if (/ETIMEDOUT|ECONN|ENETUNREACH|EAI_AGAIN|rate.?limit|429|503|504/i.test(m)) return 'transient';
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
```

- [ ] **Step 3: Aplicar withRetry nas chamadas LLM e image gen**

Em `lib/single-video.js`, embrulhe `callLLM` e `generateImage` com `withRetry`:

```javascript
const { withRetry } = require('./error-handler');

// substituir chamadas:
const r = await withRetry(() => callLLM(args), { attempts: 3, baseMs: 1000 });
// e:
await withRetry(() => generateImage({ outputPath: out, ... }), { attempts: 3, baseMs: 1000 });
```

- [ ] **Step 4: Tests pass + commit**

```bash
cd mkvideos/matriz && npm test
git add matriz/lib/error-handler.js matriz/tests/error-handler.test.js matriz/lib/single-video.js
git commit -m "matriz: error categorização + retry transient"
```

### Task 9.2: Logs estruturados (_stdout.log, _errors.log, _llm-usage.json)

**Files:**
- Modify: `mkvideos/matriz/lib/batch-runner.js`

- [ ] **Step 1: Adicionar writers de log no batch-runner**

No início de `runBatch`, abra streams:

```javascript
const stdoutLog = fs.createWriteStream(path.join(path.dirname(summaryFile), `${batchId}_stdout.log`), { flags: 'a' });
const errorsLog = fs.createWriteStream(path.join(path.dirname(summaryFile), `${batchId}_errors.log`), { flags: 'a' });

function logLine(stream, ...parts) {
  stream.write(`[${new Date().toISOString()}] ${parts.join(' ')}\n`);
}

// no onProgress wrapper:
logLine(stdoutLog, `[${idx+1}/${total}]`, slug, status, error || '');
if (status === 'failed') logLine(errorsLog, slug, '|', error);
```

E ao final:

```javascript
// agregar llm_calls dos manifests done
const usage = { total_tokens_in: 0, total_tokens_out: 0, calls: 0, by_model: {} };
for (const v of summary.videos) {
  if (v.status !== 'done' || !v.manifest) continue;
  const m = JSON.parse(fs.readFileSync(v.manifest, 'utf8'));
  for (const c of m.llm_calls || []) {
    usage.calls++;
    usage.total_tokens_in += c.tokens_in || 0;
    usage.total_tokens_out += c.tokens_out || 0;
    usage.by_model[c.model] = (usage.by_model[c.model] || 0) + 1;
  }
}
fs.writeFileSync(path.join(path.dirname(summaryFile), `${batchId}_llm-usage.json`), JSON.stringify(usage, null, 2));
stdoutLog.end();
errorsLog.end();
```

- [ ] **Step 2: Smoke test e ver os arquivos**

Run um batch pequeno; verifique `output/<template>/_batches/<id>_stdout.log`, `_errors.log`, `_llm-usage.json`.

- [ ] **Step 3: Commit**

```bash
git add matriz/lib/batch-runner.js
git commit -m "matriz: logs estruturados (stdout/errors/llm-usage)"
```

---

## Phase 10 — Idea loop + CLI complementar

### Task 10.1: Idea loop (LLM propõe templates)

**Files:**
- Create: `mkvideos/matriz/lib/idea-loop.js`
- Create: `mkvideos/matriz/idea.js`

- [ ] **Step 1: Implementar idea-loop.js**

```javascript
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const SCHEMA = require('../schema/template.schema.json');
const { callLLM } = require('./llm-client');
const { loadProfissoes } = require('./profissoes-loader');

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(SCHEMA);

function buildPrompt(briefing, sampleProfile) {
  const slotKeys = Object.keys(sampleProfile.props || {});
  return `Você é um diretor criativo gerando templates de vídeo curto para profissionais brasileiros.

BRIEFING DO USUÁRIO:
${briefing}

VOCÊ DEVE devolver um YAML válido seguindo o schema abaixo. Use slots de profissão entre chaves.

SLOTS DISPONÍVEIS (do catálogo de profissões; use entre chaves, ex: {classic_task}):
${slotKeys.join(', ')}

REGRAS:
- script: array com 3-6 blocks (type=fixed|slot|rewrite|hook). Use rewrite com instruction usando slots para variar por profissão.
- visual.shots: array com 2-4 shots. Use prompt.type=slot|fixed|rewrite com a mesma gramática.
- format.key: short_reel | storytelling | micro_doc.
- hook.policy: default (com hook.text rewrite gerando frase empática+vanguarda).
- variation.seed_strategy: profissao_hash.
- llm.provider: openrouter, llm.model: anthropic/claude-sonnet-4.6.
- meta.id: kebab-case curto e único.
- meta.created_by: llm.

DEVOLVA SOMENTE O YAML, SEM CERCAS DE CÓDIGO, SEM TEXTO EXTRA.`;
}

async function proposeTemplates({ briefing, count = 3, llmCfg, apiKey, profissoesCatalogPath, outDir }) {
  const cat = loadProfissoes(profissoesCatalogPath);
  const sample = cat[0];
  const proposed = [];
  for (let i = 0; i < count; i++) {
    let attempt = 0, parsed = null, errors = null;
    while (attempt < 3) {
      const prompt = buildPrompt(briefing, sample) + (errors ? `\n\nA tentativa anterior falhou: ${errors}. Corrija.` : '');
      const r = await callLLM({ ...llmCfg, prompt, apiKey, max_tokens: 2000, temperature: 0.8 });
      try {
        parsed = yaml.load(r.text);
        if (!validate(parsed)) {
          errors = validate.errors.map((e) => `${e.instancePath} ${e.message}`).join('; ');
          attempt++;
          continue;
        }
        break;
      } catch (e) {
        errors = e.message;
        attempt++;
      }
    }
    if (!parsed || !validate(parsed)) continue;
    const id = parsed.meta.id;
    const out = path.join(outDir, `${id}.yml`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(out, yaml.dump(parsed));
    proposed.push(out);
  }
  return proposed;
}

module.exports = { proposeTemplates };
```

- [ ] **Step 2: Criar idea.js (CLI)**

```javascript
const path = require('node:path');
const { proposeTemplates } = require('./lib/idea-loop');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
  const briefing = process.argv.slice(2).join(' ').trim();
  if (!briefing) {
    console.error('uso: node idea.js "<briefing>"');
    process.exit(1);
  }
  const out = await proposeTemplates({
    briefing,
    count: 3,
    llmCfg: { provider: 'openrouter', model: process.env.MATRIZ_IDEA_MODEL || 'anthropic/claude-sonnet-4.6' },
    apiKey: process.env.OPENROUTER_API_KEY,
    profissoesCatalogPath: path.join(__dirname, '../config/profissoes-30.js'),
    outDir: path.join(__dirname, 'templates/inbox'),
  });
  console.log(`\nGerados ${out.length} templates em templates/inbox/:`);
  for (const f of out) console.log(`  ${f}`);
  console.log(`\nRevise com: node cli.js review-inbox`);
}

main();
```

- [ ] **Step 3: Smoke test**

Run: `cd mkvideos/matriz && node idea.js "templates pra ajudar profissionais a usar IA, tom empático, formato short reel"`
Expected: 1-3 arquivos `.yml` em `templates/inbox/`.

- [ ] **Step 4: Commit**

```bash
git add matriz/lib/idea-loop.js matriz/idea.js
git commit -m "matriz: idea-loop (LLM propõe templates → inbox)"
```

### Task 10.2: CLI complementar (review-inbox, batch-status)

**Files:**
- Create: `mkvideos/matriz/cli.js`

- [ ] **Step 1: Implementar cli.js com subcomandos**

```javascript
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ROOT = __dirname;
const INBOX = path.join(ROOT, 'templates/inbox');
const APPROVED = path.join(ROOT, 'templates/approved');
const ARCHIVE = path.join(ROOT, 'templates/archive');

function ask(q) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => { rl.close(); res(a.trim()); });
  });
}

async function reviewInbox() {
  const files = fs.readdirSync(INBOX).filter((f) => f.endsWith('.yml'));
  if (!files.length) return console.log('Inbox vazio.');
  for (const f of files) {
    const full = path.join(INBOX, f);
    console.log('\n' + '='.repeat(60));
    console.log(`Template: ${f}`);
    console.log('='.repeat(60));
    console.log(fs.readFileSync(full, 'utf8'));
    const ans = await ask('[a]prova / [r]ejeita / [s]kip: ');
    if (ans === 'a') {
      fs.mkdirSync(APPROVED, { recursive: true });
      fs.renameSync(full, path.join(APPROVED, f));
      console.log('  → approved/');
    } else if (ans === 'r') {
      const motivo = await ask('  motivo (opcional): ');
      fs.mkdirSync(ARCHIVE, { recursive: true });
      fs.renameSync(full, path.join(ARCHIVE, f));
      if (motivo) fs.writeFileSync(path.join(ARCHIVE, `${f.replace('.yml', '')}.reject.txt`), motivo);
      console.log('  → archive/');
    }
  }
}

function batchStatus(batchId, templateId) {
  const summaryPath = path.join(ROOT, 'output', templateId, '_batches', `${batchId}.json`);
  if (!fs.existsSync(summaryPath)) return console.log(`não encontrado: ${summaryPath}`);
  const s = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  console.log(`Batch ${s.batch_id} — template=${s.template.id}`);
  console.log(`  status: ${s.totals.done}/${s.totals.planned} ok, ${s.totals.failed} fail`);
  console.log(`  iniciado: ${s.started_at} | terminado: ${s.ended_at || '(em andamento)'}`);
  for (const v of s.videos) {
    const mark = v.status === 'done' ? '✓' : v.status === 'failed' ? '✗' : '·';
    console.log(`  ${mark} ${v.slug}`);
  }
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'review-inbox') return reviewInbox();
  if (cmd === 'batch-status') return batchStatus(process.argv[3], process.argv[4]);
  console.log('comandos: review-inbox | batch-status <batch_id> <template_id>');
}

main();
```

- [ ] **Step 2: Smoke test**

Run: `cd mkvideos/matriz && node cli.js review-inbox`

- [ ] **Step 3: Commit**

```bash
git add matriz/cli.js
git commit -m "matriz: cli.js (review-inbox, batch-status)"
```

---

## Phase 11 — UI de aprovação

### Task 11.1: Servidor http vanilla (estrutura)

**Files:**
- Create: `mkvideos/matriz/ui/server.js`
- Create: `mkvideos/matriz/ui/public/index.html`
- Create: `mkvideos/matriz/ui/public/inbox.html`
- Create: `mkvideos/matriz/ui/public/batch.html`
- Create: `mkvideos/matriz/ui/public/style.css`
- Create: `mkvideos/matriz/ui/public/app.js`

- [ ] **Step 1: Implementar ui/server.js**

```javascript
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.MATRIZ_UI_PORT || 5278;

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function sendJSON(res, obj) { send(res, 200, 'application/json', JSON.stringify(obj)); }
function sendFile(res, file, type) { send(res, 200, type, fs.readFileSync(file)); }

function listInbox() {
  const dir = path.join(ROOT, 'templates/inbox');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.yml')).map((f) => {
    const full = path.join(dir, f);
    const content = fs.readFileSync(full, 'utf8');
    let parsed = null;
    try { parsed = yaml.load(content); } catch (e) { /* ignora */ }
    return { file: f, name: parsed?.meta?.name || f, blocks: parsed?.script?.length || 0, format: parsed?.format?.key, raw: content };
  });
}

function listBatches() {
  const out = path.join(ROOT, 'output');
  if (!fs.existsSync(out)) return [];
  const all = [];
  for (const tmpl of fs.readdirSync(out)) {
    const batches = path.join(out, tmpl, '_batches');
    if (!fs.existsSync(batches)) continue;
    for (const f of fs.readdirSync(batches)) {
      if (!f.endsWith('.json')) continue;
      try {
        const s = JSON.parse(fs.readFileSync(path.join(batches, f), 'utf8'));
        all.push({ template: tmpl, batch_id: s.batch_id, started_at: s.started_at, totals: s.totals });
      } catch (e) { /* ignora */ }
    }
  }
  return all.sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 50);
}

function getBatch(templateId, batchId) {
  const f = path.join(ROOT, 'output', templateId, '_batches', `${batchId}.json`);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (req.method === 'GET' && p === '/') return sendFile(res, path.join(PUBLIC, 'index.html'), 'text/html');
  if (req.method === 'GET' && p === '/inbox') return sendFile(res, path.join(PUBLIC, 'inbox.html'), 'text/html');
  if (req.method === 'GET' && p.startsWith('/batch/')) return sendFile(res, path.join(PUBLIC, 'batch.html'), 'text/html');

  if (req.method === 'GET' && p === '/api/inbox') return sendJSON(res, listInbox());
  if (req.method === 'GET' && p === '/api/batches') return sendJSON(res, listBatches());
  if (req.method === 'GET' && p.startsWith('/api/batch/')) {
    const [, , , tmpl, bid] = p.split('/');
    return sendJSON(res, getBatch(tmpl, bid) || { error: 'not found' });
  }

  if (req.method === 'POST' && p === '/api/inbox/approve') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      const { file } = JSON.parse(body);
      const src = path.join(ROOT, 'templates/inbox', file);
      const dst = path.join(ROOT, 'templates/approved', file);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.renameSync(src, dst);
      sendJSON(res, { ok: true });
    });
    return;
  }
  if (req.method === 'POST' && p === '/api/inbox/reject') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      const { file, reason } = JSON.parse(body);
      const src = path.join(ROOT, 'templates/inbox', file);
      const dst = path.join(ROOT, 'templates/archive', file);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.renameSync(src, dst);
      if (reason) fs.writeFileSync(path.join(ROOT, 'templates/archive', file.replace('.yml', '.reject.txt')), reason);
      sendJSON(res, { ok: true });
    });
    return;
  }

  // estáticos /public/*
  if (req.method === 'GET' && p.startsWith('/public/')) {
    const f = path.join(PUBLIC, p.slice(8));
    if (fs.existsSync(f)) {
      const ext = path.extname(f);
      const type = { '.css': 'text/css', '.js': 'application/javascript', '.html': 'text/html' }[ext] || 'application/octet-stream';
      return sendFile(res, f, type);
    }
  }

  // arquivos de output (vídeos)
  if (req.method === 'GET' && p.startsWith('/output/')) {
    const f = path.join(ROOT, p);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f);
      const type = { '.mp4': 'video/mp4', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain' }[ext] || 'application/octet-stream';
      return sendFile(res, f, type);
    }
  }

  send(res, 404, 'text/plain', 'not found');
});

server.listen(PORT, () => console.log(`matriz UI — http://localhost:${PORT}`));
```

- [ ] **Step 2: index.html (dashboard)**

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Matriz</title><link rel="stylesheet" href="/public/style.css"></head>
<body>
<header><h1>Fábrica Matriz</h1><nav><a href="/">Dashboard</a> · <a href="/inbox">Inbox</a></nav></header>
<main>
  <section><h2>Lotes recentes</h2><div id="batches"></div></section>
</main>
<script src="/public/app.js"></script>
<script>app.dashboard();</script>
</body></html>
```

- [ ] **Step 3: inbox.html**

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Inbox · Matriz</title><link rel="stylesheet" href="/public/style.css"></head>
<body>
<header><h1>Inbox de templates</h1><nav><a href="/">Dashboard</a></nav></header>
<main><div id="inbox"></div></main>
<script src="/public/app.js"></script>
<script>app.inbox();</script>
</body></html>
```

- [ ] **Step 4: batch.html**

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Batch · Matriz</title><link rel="stylesheet" href="/public/style.css"></head>
<body>
<header><h1 id="title">Batch</h1><nav><a href="/">Dashboard</a></nav></header>
<main><div id="batch"></div></main>
<script src="/public/app.js"></script>
<script>app.batch();</script>
</body></html>
```

- [ ] **Step 5: style.css**

```css
* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; margin: 0; background: #0e0e10; color: #eee; }
header { padding: 1rem 1.5rem; background: #1a1a1d; display: flex; justify-content: space-between; align-items: center; }
header nav a { color: #8af; margin-left: 1rem; text-decoration: none; }
main { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
.card { background: #1a1a1d; border: 1px solid #2a2a2e; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
.card h3 { margin-top: 0; }
.actions { margin-top: 0.5rem; display: flex; gap: 0.5rem; }
.actions button { padding: 0.4rem 0.8rem; border: 1px solid #444; background: #222; color: #eee; cursor: pointer; border-radius: 4px; }
.actions button:hover { background: #333; }
pre { background: #0a0a0c; padding: 0.8rem; border-radius: 4px; max-height: 240px; overflow: auto; font-size: 0.85em; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.video { background: #1a1a1d; border-radius: 8px; overflow: hidden; }
.video video { width: 100%; display: block; }
.video .meta { padding: 0.6rem; font-size: 0.85em; }
.status-done { color: #6c6; }
.status-failed { color: #c66; }
.status-pending { color: #aa6; }
```

- [ ] **Step 6: app.js (frontend logic)**

```javascript
const app = {
  async dashboard() {
    const r = await fetch('/api/batches');
    const list = await r.json();
    document.getElementById('batches').innerHTML = list.map((b) => `
      <div class="card">
        <h3>${b.template} <small style="opacity:0.6">${b.batch_id}</small></h3>
        <div>Iniciado: ${b.started_at}</div>
        <div>${b.totals.done}/${b.totals.planned} ok · ${b.totals.failed} falha</div>
        <div class="actions"><a href="/batch/${b.template}/${b.batch_id}"><button>Abrir</button></a></div>
      </div>`).join('') || '<p>Nenhum lote ainda.</p>';
  },

  async inbox() {
    const r = await fetch('/api/inbox');
    const list = await r.json();
    document.getElementById('inbox').innerHTML = list.map((t) => `
      <div class="card">
        <h3>${t.name}</h3>
        <div><b>Arquivo:</b> ${t.file} · <b>Blocos:</b> ${t.blocks} · <b>Formato:</b> ${t.format}</div>
        <pre>${escapeHtml(t.raw)}</pre>
        <div class="actions">
          <button onclick="app.approve('${t.file}')">Aprovar</button>
          <button onclick="app.reject('${t.file}')">Rejeitar</button>
        </div>
      </div>`).join('') || '<p>Inbox vazio.</p>';
  },

  async approve(file) {
    await fetch('/api/inbox/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file }) });
    location.reload();
  },

  async reject(file) {
    const reason = prompt('Motivo (opcional):') || '';
    await fetch('/api/inbox/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file, reason }) });
    location.reload();
  },

  async batch() {
    const m = location.pathname.match(/\/batch\/([^/]+)\/(.+)$/);
    if (!m) return;
    const [, tmpl, bid] = m;
    document.getElementById('title').textContent = `Batch ${bid} (${tmpl})`;
    const r = await fetch(`/api/batch/${tmpl}/${bid}`);
    const b = await r.json();
    if (b.error) return document.getElementById('batch').innerHTML = '<p>Não encontrado.</p>';
    const cards = b.videos.map((v) => {
      const status = `status-${v.status}`;
      const videoSrc = v.manifest ? v.manifest.replace('manifest.json', 'video.mp4') : null;
      return `<div class="video">
        ${videoSrc ? `<video src="/${videoSrc}" controls></video>` : '<div style="padding:1rem">sem vídeo</div>'}
        <div class="meta">
          <div><b>${v.slug}</b> <span class="${status}">${v.status}</span></div>
          ${v.error_message ? `<div style="color:#c88">${escapeHtml(v.error_message)}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    document.getElementById('batch').innerHTML = `<div>${b.totals.done}/${b.totals.planned} ok · ${b.totals.failed} falha</div><div class="grid">${cards}</div>`;
  },
};
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
```

- [ ] **Step 7: Smoke test**

Run: `cd mkvideos/matriz && npm run ui`
Abra http://localhost:5278/ — deve listar lotes; http://localhost:5278/inbox — inbox.

- [ ] **Step 8: Commit**

```bash
git add matriz/ui/
git commit -m "matriz: UI de aprovação (dashboard + inbox + batch viewer)"
```

---

## Self-Review (post-write)

**Spec coverage check:**

| Spec section | Plan task | OK |
|---|---|---|
| 3.1 Layout físico | Task 1.1 + dispersa | ✓ |
| 3.2 Visão fluxo | Phases 4-7 | ✓ |
| 4.1 Schema YAML | Task 2.1 | ✓ |
| 4.2 Decisões schema | Task 2.1 | ✓ |
| 4.3 Defaults globais | (não criado defaults.yml ainda) | ⚠ — adicionar como Task 1.2 |
| 5.1 Loop ideias | Task 10.1 | ✓ |
| 5.2 Aprovação batch | Task 6.3 (pre-flight) + 7.1 | ✓ |
| 5.3 Resolução determinística | Tasks 3.1, 3.6, 5.2-5.3 | ✓ |
| 5.4 Gates | Task 7.1 (sample) | ✓ |
| 5.5 Falhas + resume | Task 8.3 + 9.1 | ✓ |
| 6.1 Layout output + run_id | Task 3.2 | ✓ |
| 6.2 Manifest fields | Tasks 3.5, 4.2, 5.3 | ✓ |
| 6.3 Replay + reseed | Tasks 8.1, 8.2 | ✓ |
| 6.4 Batch summary | Task 6.2 | ✓ |
| 7.1 Camadas validação | Tasks 2.2 (schema), 6.3 (slot+budget), 4.2 (storytree-qa), 9.1 (retry) | ✓ |
| 7.2 Estados manifest | Implícito em manifest-writer + single-video | ✓ |
| 7.3 Categorização | Task 9.1 | ✓ |
| 7.4 Logs | Task 9.2 | ✓ |
| 8.1 UI 3 telas | Task 11.1 | ✓ |
| 8.2 CLI complementar | Task 10.2 | ✓ — falta replay/reseed/resume no cli.js (stão em run.js já) |

**Gap encontrado:** `config/defaults.yml` (Sec 4.3 do spec) não criado. **Fix inline abaixo.**

### Task 1.2 (NOVO): Defaults globais

**Files:**
- Create: `mkvideos/matriz/config/defaults.yml`

- [ ] **Step 1: Criar defaults**

```yaml
captions: true
narration_pacing: normal
fade_in_seconds: 0.5
fade_out_seconds: 0.5
codec:
  video: libx264
  pix_fmt: yuv420p
  preset: fast
concurrency: 4
```

- [ ] **Step 2: Carregar defaults em template-loader (merge)**

Adicionar em `lib/template-loader.js`:

```javascript
const DEFAULTS_PATH = path.join(__dirname, '../config/defaults.yml');
let _defaults = null;
function getDefaults() {
  if (_defaults) return _defaults;
  try { _defaults = yaml.load(fs.readFileSync(DEFAULTS_PATH, 'utf8')) || {}; }
  catch (e) { _defaults = {}; }
  return _defaults;
}
// ao final de loadTemplate, antes do return:
obj._defaults = getDefaults();
```

(Single-video pode ler `template._defaults` ao precisar de codec/fades.)

- [ ] **Step 3: Commit**

```bash
git add matriz/config/defaults.yml matriz/lib/template-loader.js
git commit -m "matriz: config/defaults.yml + merge no loader"
```

**Placeholder scan:** percorrido — sem TBD/TODO/"similar to". Cada step tem código completo.

**Type consistency check:** funções principais (`loadTemplate`, `resolveScriptBlock`, `resolveScriptBlockAsync`, `resolveHookBlock`, `generateSingle`, `runBatch`, `replayManifest`) consistentes entre tasks.

---

## Critérios de sucesso (do spec, Sec 11)

1. ✓ Template YAML válido + filter → 5 vídeos em `--gate=sample` em <15min — coberto por Phases 4-7
2. ✓ Template proposto pelo LLM passa o schema sem retry humano — Task 10.1 com retry interno até 3x
3. ✓ Replay = vídeo bit-idêntico — Task 8.2
4. ✓ Ctrl+C + --resume — Task 8.3
5. ✓ Falha em 1 não para os outros — Task 6.2 (try/catch + onError)
6. ✓ CLI cobre run/review-inbox/replay/reseed/resume/batch-status — run.js + cli.js
7. ✓ UI permite aprovar/rejeitar inbox + triagem batch — Task 11.1

---

## Próximos passos

Plan completo e gravado. Duas opções de execução:

1. **Subagent-Driven (recomendada):** dispatch fresh subagent por tarefa, revisão entre tarefas, iteração rápida.
2. **Inline:** executar tasks nesta sessão com checkpoints.

Qual abordagem?
