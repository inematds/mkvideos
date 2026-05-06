# mkvideos

Factory standalone de vídeos com imagens estáticas + motion cinematográfico.

Geradores (`gen-*.js`) e renderizadores (`render-*.js`) que produzem reels e vídeos
narrativos a partir de imagens IA + ffmpeg `zoompan` + faixa de áudio.

Repo: https://github.com/inematds/mkvideos

## Templates incluídos

| Template | Gen | Render | Output |
|---|---|---|---|
| **Storytree** | `gen-storytree-happy.js` | `render-storytree-v2.js` | 9:16 50-60s, motion grammar |
| **CriaProf** | `gen-criaprof.js` | `render-criaprof.js` (1:1) / `render-criaprof-916.js` (9:16) | jornada criança→profissional 45s |
| **CriaProf-CTA-916** | reusa imgs CriaProf | `render-criaprof-cta-916.js` | reels 37s com hook+CTA |
| **CriaProf Comic A** | `gen-criaprof-comic-A.js` | `render-criaprof-comic-A-cta-916.js` | estilo Calvin & Hobbes |
| **GERTRAN** | `gen-gertran-nostalgia.js` | `render-gertran.js` | reels 31s público 35+ |
| **Paired/Decades/Artifacts** | `gen-extra.js` | `render-extra.js` | reels 31s timeline |
| **DarkStory** (V1/V2/V2.5) | `gen-darkstory.js` / `gen-darkstory-cinematic.js` | `render-darkstory*.js` | vídeo longo dark + Aronofsky montage |
| **INEMA institucional** | `gen-eu-vi-o-futuro.js` / `gen-antes-do-futuro.js` | `render-eu-vi-o-futuro.js` / `render-antes-do-futuro.js` | 1:1 60s autoral |

## Dependências externas (não vivem aqui)

Esse repo NÃO empacota os daemons — eles rodam como infra separada e são acessados via HTTP. Configure as URLs via env vars:

| Daemon | Default URL | Função | Repo |
|---|---|---|---|
| **inemaimg** | `http://localhost:8000` | API multi-modelo de geração de imagem (FLUX.2, Qwen, ERNIE) | `~/projetos/inemaimg` |
| **Chatterbox TTS** | `http://127.0.0.1:7860` | TTS local (vozes rachel, bella) | externo |
| **inemavox** | `http://192.168.2.99:8010` | Proxy Freesound + library local de música/SFX | externo |

## Variáveis de ambiente

Crie `.env` com:

```bash
# inemaimg (image generation)
INEMAIMG_URL=http://localhost:8000
INEMAIMG_MODEL=flux2-klein           # flux2-klein|qwen-edit-2511|ernie|flux2-dev
INEMAIMG_QUALITY=fast                # fast|high
INEMAIMG_TIMEOUT_S=1800

# Chatterbox TTS
CHATTERBOX_URL=http://127.0.0.1:7860
CHATTERBOX_VOICE=rachel              # rachel|bella

# inemavox (Freesound proxy)
INEMAVOX_URL=http://192.168.2.99:8010
```

## Pré-requisitos do sistema

- Node 18+
- ffmpeg 6.1+
- Os 3 daemons acima rodando

## Setup

```bash
npm install
cp .env.example .env  # se existir, ou criar manualmente
node --check render-storytree-v2.js  # smoke check
```

## Smoke test

```bash
# checa syntax de todos os scripts
npm run check:syntax

# render storytree (precisa imgs em output/videos/...)
node render-storytree-v2.js

# gera história alegre ponta-a-ponta (12 imgs novas + render)
node gen-storytree-happy.js
```

## Estrutura

```
mkvideos/
├── lib/                 # storytree-* (motion grammar) + camera-moves + inemavox-client
├── pipeline/            # generate-image-{inemaimg,kie,piramyd,pollinations}.js
├── gen-lib/             # scene-templates.js
├── config/              # env.js + profissoes-*.js
├── doc/                 # storytree-canais-referencia.md + outros
├── media/               # musicas/, sfx/, voice-refs/ — adicionar manualmente
├── prj/                 # outputs por projeto (gitignored)
├── render-*.js          # renderizadores (16)
└── gen-*.js             # geradores (18)
```

## Documentação técnica

Ver `doc/storytree-canais-referencia.md` — análise dos 5 canais YouTube TOP (LEMMiNO, Nexpo, Bedtime Stories, melodysheep, hochelaga) que fundamentou a arquitetura motion grammar.
