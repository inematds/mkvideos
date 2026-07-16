# Fábrica Matriz — Design

**Data:** 2026-05-07
**Status:** Draft (aguardando revisão do usuário)
**Escopo:** Sistema novo em `mkvideos/matriz/`, isolado, que gera vídeos em escala via templates declarativos × catálogo de profissões.

---

## 1. Objetivo

Permitir que um único "template mestre" se aplique a N profissões do catálogo (`config/profissoes-30.js` etc.) e produza N vídeos com padrão repetível mas variação controlada por profissão. O sistema:

- Aceita ideias de templates do usuário ou propostas pelo LLM (com aprovação humana antes de virar template ativo).
- Adapta cada template a cada profissão via gramática híbrida (texto fixo + slots + reescrita LLM).
- Aplica um hook de marca ("empatia + ajudar a ficar na vanguarda") como default redirecionável.
- Gera vídeos de forma reproduzível 1:1 via manifest determinístico, com opção `--reseed` para variação.
- Oferece dois gates de aprovação por lote: amostra (3-5 vídeos antes do resto) ou triagem final (gera tudo, você filtra).

## 2. Restrições e princípios

1. **Zero edição em mkvideos atual.** O novo sistema vive em `mkvideos/matriz/`, importa via path relativo (`require('../lib/storytree-presets')`, etc.), não modifica nenhum arquivo existente do mkvideos.
2. **Templates são dado, não código.** YAML versionado no git, validado por JSON-Schema. Permite que o LLM proponha templates como output estruturado.
3. **Reuso máximo do existente:** `lib/storytree-*` (motion engine), `pipeline/generate-image-*`, `render-storytree-v2.js`, `config/profissoes-*.js`, `gen-lib/scene-templates.js` (referência de pattern).
4. **Falha cedo, observabilidade simples.** Validação em camadas (schema → slots → orçamento → storytree-qa → render). Manifest sempre escrito antes da mídia.
5. **CLI primeiro, UI quando precisar.** UI é cômodo, não pré-requisito.

## 3. Arquitetura

### 3.1 Layout físico

```
mkvideos/                              ← INTOCADO
  ├─ gen-*.js, render-*.js, ui/        (não muda)
  ├─ lib/storytree-*                   (importado pela matriz)
  ├─ pipeline/generate-image-*         (importado)
  ├─ config/profissoes-*.js            (lido)
  ├─ gen-lib/scene-templates.js        (referência)
  │
  └─ matriz/                           ← SISTEMA NOVO
      ├─ package.json
      ├─ README.md
      ├─ run.js                        (orquestrador principal)
      ├─ idea.js                       (gera templates via LLM)
      ├─ cli.js                        (review-inbox, status, replay, etc.)
      ├─ lib/
      │   ├─ template-loader.js        (lê YAML, valida schema)
      │   ├─ template-resolver.js      (slots + LLM rewrite)
      │   ├─ idea-loop.js              (LLM propõe templates)
      │   ├─ manifest-writer.js
      │   ├─ gates.js                  (sample | none)
      │   └─ qa-pipeline.js            (orquestra validações)
      ├─ schema/
      │   └─ template.schema.json      (JSON-Schema do template YAML)
      ├─ config/
      │   └─ defaults.yml              (captions, fades, codec, pacing globais)
      ├─ templates/
      │   ├─ inbox/*.yml               (LLM ou usuário propôs, pendente)
      │   ├─ approved/*.yml            (ativos, prontos pra rodar)
      │   └─ archive/*.yml             (rejeitados, com motivo)
      ├─ ui/                           (servidor http vanilla, porta 5278)
      │   ├─ server.js
      │   └─ public/
      └─ output/                       (gitignored)
          └─ <template>/<profissao>/
              ├─ latest.json           (aponta pro último run_id)
              └─ <run_id>/
                  ├─ manifest.json
                  ├─ resolved-script.txt
                  ├─ imgs/
                  └─ video.mp4
```

### 3.2 Visão de fluxo

```
[IDEIAS]               [CATÁLOGO mkvideos]
- usuário              profissoes-*.js
- LLM sugere           (slot fillers)
  ↓
[TEMPLATE YAML]
  ↓
[ORQUESTRADOR matriz/run.js]
  1. Carrega + valida template
  2. Resolve slots / chama LLM em blocos rewrite
  3. Monta ShotPlan via lib/storytree-shot-schema
  4. validateShotPlan (storytree-qa)
  5. Escreve manifest.json
  6. pipeline/generate-image-* → PNGs
  7. render-storytree-v2 → mp4
  ↓
[GATE]
  --gate=sample: 3-5 amostras → você aprova → resto
  --gate=none:   gera tudo → triagem final
  ↓
[OUTPUT]
  output/<template>/<profissao>/<run_id>/{video.mp4, manifest.json, ...}
```

## 4. Schema do template YAML

Quatro tipos de bloco no script: `fixed`, `slot`, `rewrite`, `hook`. Mesma gramática vale para prompts visuais. Validado por `schema/template.schema.json`.

### 4.1 Exemplo completo

```yaml
meta:
  id: como-usar-ia-vanguarda
  version: 1
  name: "Como você pode usar IA pra ficar na vanguarda"
  created_by: user                  # ou "llm"
  created_at: 2026-05-07

target:
  catalog: ../../config/profissoes-30.js
  filter: {}                        # opcional: { area: "saude" }, { slug: "fisioterapeuta" }

format:
  key: short_reel                   # short_reel | storytelling | micro_doc
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
  policy: default                   # default | required | off | override
  position: outro                   # intro | outro | both
  text:
    type: rewrite
    instruction: "Frase 12-15 palavras, empática, reconhece desafio do(a) {profissao_label} e convida aprender IA pra se manter na vanguarda."

variation:
  seed_strategy: profissao_hash     # determinística por slug
  rewrite_temperature: 0.7
  diversify_camera_moves: true      # storytree-selector escolhe move diferente por profissão
  diversify_music: false            # se true, alterna trilhas dentro do mesmo style

llm:
  provider: openrouter
  model: anthropic/claude-sonnet-4.6
  max_tokens: 200
```

### 4.2 Decisões do schema

| Decisão | Razão |
|---|---|
| 4 block types: `fixed`, `slot`, `rewrite`, `hook` | Cobre o espectro híbrido com vocabulário mínimo. LLM gera bem com gramática pequena. |
| Slots usam `{nome_do_prop}` direto do `profissoes-*.js` | Já existe; zero migração de dados. |
| `hook` é block-type, não campo separado | Permite injetar em qualquer posição (intro/outro/both). Composição uniforme. |
| `format.key` reusa `storytree-rhythm.js` (`short_reel`/`storytelling`/`micro_doc`) | Storytree já tem phase distribution definida por formato. Reuso 100%. |
| `variation.seed_strategy: profissao_hash` | Mesma profissão sempre gera mesma seed → reproduz 1:1. |
| YAML, não JSON | LLM gera com mais robustez; humanos leem melhor; comentários permitidos. |
| Validação via JSON-Schema separado | Falha cedo, mensagem clara, LLM pode usar o schema pra gerar válido. |

### 4.3 Defaults globais

`matriz/config/defaults.yml` define captions, narration_pacing, fades, codec h264. Template sobrescreve campos específicos se quiser; campos omitidos puxam do default.

## 5. Fluxos

### 5.1 Loop de ideias (criar template novo)

**Origem usuário:** edita YAML diretamente em `templates/inbox/` ou `approved/`.

**Origem LLM:**
```
node matriz/idea.js "templates pra ajudar profissionais a usar IA, tom empático, formato short reel"
```

`idea-loop.js` chama LLM com:
- O `template.schema.json`
- Lista de profissões disponíveis
- Lista de slots disponíveis (varre `profissoes-*.js`)
- Restrições (formats válidos, hook policies)

LLM devolve N candidatos como YAML; cada um é validado contra schema (re-tenta se inválido); aprovados pelo schema vão para `templates/inbox/<id>.yml`.

**Revisão (CLI primeiro, UI depois):**
- CLI: `matriz/cli.js review-inbox` → lista, abre cada YAML, pede `[a]prova / [r]ejeita / [e]dita / [s]kip`
- Aprovados: `mv` para `templates/approved/`
- Rejeitados: `mv` para `templates/archive/` + motivo registrado em sidecar `<id>.reject.txt`

### 5.2 Aprovação batch

```
node matriz/run.js approved/como-usar-ia-vanguarda.yml \
  --gate=sample           # ou --gate=none
  --filter=area:saude     # opcional
  --limit=10              # opcional
  --resume <batch_id>     # opcional, refaz só os failed
  --replay <manifest>     # opcional, re-roda 1:1 a partir do manifest
  --reseed                # opcional, força nova seed
```

Antes de gerar mídia:

1. Carrega template, valida schema.
2. Resolve subset de profissões (filter + limit).
3. **Pre-flight slot check:** confere que cada slot referenciado existe nas profissões alvo. Se falta → lista as profissões problemáticas, oferece [a]bortar / [s]kip-faltantes / [c]ontinuar-com-warning.
4. **Pre-flight orçamento:** "23 vídeos | 92 LLM calls (~46k tokens, ~$0.30) | 69 imagens (~12 min em fast, 35 min em high) | OK? [y/N]"
5. Confirma → começa.

### 5.3 Resolução por profissão (algoritmo determinístico)

Por profissão alvo:

1. `profile = profissoes.find(p => p.slug === alvo)`
2. Para cada bloco do `script`:
   - `fixed` → texto literal (substitui `{profissao_label}` se presente)
   - `slot` → preenche `{nome}` com `profile.props[nome]`
   - `rewrite` → chama LLM com `instruction` + slots resolvidos + `temperature`; seed derivada de `hash(profile.slug + bloco.role)` quando `--reseed` ausente
   - `hook` → se `policy=default|required`, resolve `hook.text` (rewrite/slot/fixed); se `policy=off`, pula bloco; se `policy=override`, lê texto/instruction novos do CLI flag `--hook-override="<instruction>"` ou de `<batch_id>.overrides.yml` e usa em lugar do `hook.text` original do template
3. Mesma lógica para `visual.shots`.
4. `audio` resolvido (música pode variar por profissão se `variation.diversify_music=true`; voice fixa).
5. Monta `ShotPlan` via `../lib/storytree-shot-schema` usando `format.key` + `duration_seconds`. `storytree-selector` escolhe camera move baseado em `image_class` + `role` + `diversify_camera_moves`.
6. `validateShotPlan` (storytree-qa). Errors → marca essa profissão como `failed`, lote continua.
7. **Escreve manifest ANTES de gerar mídia** (rastreabilidade).
8. `pipeline/generate-image-*` → PNGs em `output/<template>/<slug>/<run_id>/imgs/`
9. `render-storytree-v2` → `video.mp4`
10. Atualiza manifest com timings, status, output.

### 5.4 Gates

**`--gate=sample`** (recomendado):
- Sistema escolhe 3-5 profissões diversificadas (1 por área quando possível)
- Renderiza só essas
- Pausa, abre UI em `:5278/batch/<batch_id>`
- Você aprova lote ou ajusta template
- Aprovou → resto roda automático

**`--gate=none`:**
- Renderiza todas em paralelo (concurrency default = 4)
- No fim abre UI de triagem com grid + manifests
- Você marca aprovados/rejeitados pra publicação

### 5.5 Falhas e resume

- Falha em 1 profissão (image gen estourou, LLM caiu): manifest fica `status: failed`, log em `_errors.log`, lote continua
- Cancel (`Ctrl+C`): termina profissão em curso, pendentes ficam `skipped`, mensagem com `--resume <batch_id>`
- `--resume`: lê `_summary.json`, refaz só `failed`/`skipped`

## 6. Manifest schema (reprodutibilidade)

Sempre escrito antes da mídia. Layout:

```
output/<template>/<profissao>/
  ├─ latest.json
  └─ <run_id>/                        ← run_id = "2026-05-07T14-30-00_a4b1"
      ├─ manifest.json
      ├─ resolved-script.txt
      ├─ imgs/
      └─ video.mp4
```

Cada `--reseed` ou rerun cria novo `<run_id>/`. `latest.json` aponta pro mais recente.

### 6.1 Manifest fields (resumido)

```json
{
  "manifest_version": 1,
  "run_id": "2026-05-07T14-30-00_a4b1",
  "batch_id": "2026-05-07T14-30-00_b9d2",
  "template": { "id": "...", "version": 1, "file_path": "...", "file_sha256": "..." },
  "profissao": { "slug": "...", "label": "...", "catalog_file": "..." },
  "gate": { "mode": "sample|none", "selected_for_sample": true, "sample_approved_at": "..." },
  "seed": { "strategy": "profissao_hash", "value": 1742893, "reseed": false },
  "resolved": {
    "script": [ /* blocks com type + final text */ ],
    "visual": { "shots": [ /* prompt resolvido + seed_image + image_path */ ] },
    "audio": { "voice": "...", "music_track": "...", "sfx": [] },
    "format": { "key": "...", "duration_seconds": 35, "aspect": "..." },
    "hook": { "policy": "...", "position": "...", "resolved_text": "..." },
    "shot_plan": { /* ShotPlan completo do storytree */ }
  },
  "llm_calls": [ /* prompt completo + response + tokens + ms — auditável */ ],
  "timings": { "template_load_ms": 12, "resolve_ms": 1850, "image_gen_ms": 18420, "render_ms": 3210, "total_ms": 23492 },
  "status": "pending|resolving|resolved|image_generating|rendering|done|failed",
  "error": null,
  "output": { "video_path": "...", "imgs_dir": "...", "video_size_bytes": ..., "video_duration_seconds": ... },
  "qa": { "storytree_qa_warnings": [], "storytree_qa_errors": [] },
  "created_at": "...",
  "updated_at": "..."
}
```

LLM calls completos (prompt + response + tokens) por escolha — manifests crescem ~50-100KB mas auditoria de "por que esse rewrite saiu estranho?" fica trivial. Storage barato.

### 6.2 Replay 1:1 e reseed

```
node matriz/run.js --replay output/.../latest.json    # idêntico (lê resolved.* direto)
node matriz/run.js <template.yml> --filter=slug:X --reseed   # nova seed, novo run_id
```

`latest.json` sempre aponta pro mais recente. v1 fica preservado em histórico.

### 6.3 Batch summary

`output/<template>/_batches/<batch_id>.json` agrega o lote:

```json
{
  "batch_id": "...",
  "template": { "id": "...", "version": 1 },
  "gate_mode": "sample|none",
  "started_at": "...",
  "ended_at": "...",
  "totals": { "planned": 30, "done": 28, "failed": 2, "skipped": 0 },
  "videos": [ { "slug": "...", "status": "...", "manifest": "...", "error_stage": "..." } ]
}
```

## 7. Validação e erros

### 7.1 Camadas (falha-cedo)

1. **Schema YAML** — `template.schema.json`, valida estrutura ANTES de qualquer chamada externa
2. **Slot integrity** — varre profissões alvo, checa se cada slot referenciado existe nos `props`
3. **Pre-flight orçamento** — imprime estimativa, exige `[y/N]`
4. **Storytree QA** — `validateShotPlan()` antes de cada ffmpeg
5. **Render-time** — captura stderr do ffmpeg, marca failed com stack

### 7.2 Estados do manifest

```
pending → resolving → resolved → image_generating → rendering → done
                                        ↓               ↓
                                      failed         failed
```

### 7.3 Categorização de erros

| Tipo | Comportamento |
|---|---|
| Transient (rede, rate-limit, daemon down) | Retry exponencial 3x (1s, 4s, 16s) |
| Schema/slot inválido | Aborta lote inteiro, mensagem clara |
| Por-profissão (slot faltante numa, storytree-qa error) | Pula só essa, lote continua |
| Fatal (disco cheio, ffmpeg ausente, key inválida) | Aborta tudo, manifest com error.stack |

### 7.4 Logs

```
output/<template>/<batch_id>/
  ├─ _summary.json           (visão geral, atualizado live)
  ├─ _stdout.log             (todo console com timestamp)
  ├─ _errors.log             (só falhas)
  └─ _llm-usage.json         (rollup: total tokens, custo estimado)
```

Console mostra progress simples: `[12/30] fisioterapeuta — rendering... 23s`.

## 8. UI de aprovação (próprio servidor)

`mkvideos/matriz/ui/server.js` — http vanilla, porta 5278 (paralelo ao mkvideos UI em 5178).

### 8.1 Telas

**`/inbox`** — Inbox de templates propostos
- Cards com nome, descrição, contagem de blocos, formato, preview do roteiro com slots simulados em 1 profissão exemplo
- Ações: Aprovar (move pra `approved/`) | Rejeitar (move pra `archive/` com motivo) | Editar (textarea YAML, valida schema antes de gravar)

**`/batch/<batch_id>`** — Triagem de lote
- Grid de vídeos com poster + duração + status
- Click abre player + manifest expandido (script resolvido, prompts, hook usado)
- Filtros: status, profissão, área
- Ações: Aprovar para publicar | Rejeitar | Replay (mesma seed) | Reseed (nova seed)

**`/`** — Dashboard
- Templates ativos
- Lotes recentes (lê `_batches/*.json`)
- Stats: total gerados, taxa de sucesso, custo LLM acumulado

Read-mostly com algumas POSTs (mover arquivo, marcar manifest). Vanilla JS + fetch, sem framework. Mesmo estilo do mkvideos atual.

### 8.2 CLI complementar

`matriz/cli.js` cobre o mesmo via terminal: `review-inbox`, `batch-status`, `replay`, `reseed`, `resume`. Use UI quando o visual ajuda; CLI quando for batch/script.

## 9. Evolução futura — agente autônomo de ideação

Depois do MVP estabilizado, o `idea.js` (loop de ideias) pode evoluir para LLM-tool-use:
- LLM recebe briefing aberto
- Tem acesso a tools (`search_templates_existentes`, `query_profissoes_catalog`, `propose_template_yaml`, `run_sample`)
- Itera autonomamente até propor template + amostra pronta para sua aprovação

Não está no escopo do MVP. O motor declarativo descrito acima é pré-requisito porque define exatamente os "tools" que o agente futuro vai chamar — ou seja, esse design já é compatível com a evolução, sem precisar refatoração.

## 10. Fora de escopo (não fazer no MVP)

- Arquétipos não-matriz (série continuada, sazonal, explicativo) — design futuro reaproveita o motor declarativo
- Dashboard externo (Grafana etc.)
- Sistema de versionamento avançado de templates (semver, deprecation, migration)
- Distribuição/publicação automática para plataformas (YouTube, Instagram)
- A/B testing de templates
- LORA training para consistência visual em séries (relevante apenas para arquétipo SÉRIE)

## 11. Critérios de sucesso (MVP)

1. Um template YAML válido + um filter → 5 vídeos gerados em modo `sample` em < 15 min
2. Template proposto pelo LLM passa o schema sem retry humano
3. Replay de manifest produz vídeo bit-idêntico (modulo encoder não-determinismo aceitável)
4. Lote interrompido com `Ctrl+C` retoma com `--resume` sem perder estado
5. Falha em 1 vídeo não para os outros 89
6. CLI cobre `run`, `review-inbox`, `replay`, `reseed`, `resume`, `batch-status`
7. UI permite aprovar/rejeitar templates do inbox e triar vídeos do batch

---

## Próximos passos

1. **Você revisa este spec.** Aponta o que está faltando, ambíguo ou que não casa com sua intenção.
2. Após aprovação → invoco `writing-plans` para criar plano de implementação faseado.
