# TTS Daemon — Notas operacionais (chatterbox-vc)

**Criado em:** 2026-04-15
**Contexto:** Integração do provider `chatterbox-vc` como TTS default do mkvideos, usando o daemon FastAPI em `media/python/tts_daemon.py` (infra externa). Substitui Fish Audio como padrão, mantém Fish como fallback automático.

Este documento lista pontos de atenção, gotchas e decisões de design que não são óbvios só olhando o código. Para entender **o que é** o daemon e **como funciona por dentro**, ver `media/python/README.md`.

---

## Arquitetura em uma linha

```
Node (pipeline) → generateSpeech() → HTTP 127.0.0.1:7860/tts/vc → FastAPI → Edge TTS (prosódia PT-BR nativa) → ChatterboxVC (transferência de timbre) → mp3 na resposta
```

Fallback automático em caso de falha: cai para Fish Audio (mapa em `media/providers.js:TTS_FALLBACK`). O pipeline nunca quebra por daemon offline — só muda de voz silenciosamente.

---

## Pontos de atenção

### 1. Warning CUDA capability 12.1 nos logs do daemon

A GPU da máquina (NVIDIA GB10) tem CUDA capability 12.1, acima do máximo suportado pelo PyTorch instalado no conda env `chatterbox` (máx 12.0). Você verá este warning em **todas** as inicializações do daemon:

```
Found GPU0 NVIDIA GB10 which is of cuda capability 12.1.
Minimum and Maximum cuda capability supported by this version of PyTorch is (8.0) - (12.0)
```

**O que isso significa:** PyTorch está usando fallback de kernels. Funciona, mas:
- Pode ter comportamento exótico em casos raros (corrupção de tensor, NaN em edge cases)
- Performance pode estar subótima em operações específicas

**Como validar que está funcionando:** o teste end-to-end em `voice-tests/comparacao-rachel-2026-04-15/test-daemon.js` gera 2 mp3 e compara tamanho. Rode se algum dia desconfiar.

**Fix definitivo (quando bater o dia):** atualizar PyTorch para build com suporte CUDA 12.1:
```bash
/home/nmaldaner/miniconda3/envs/chatterbox/bin/pip install \
  --upgrade torch torchvision --index-url https://download.pytorch.org/whl/cu121
```
**Cuidado:** testar o Chatterbox VC depois, porque pode introduzir outro bug (o conda env está em estado estável conhecido).

### 2. Edge TTS depende de rede Azure Microsoft

O passo 1 do pipeline (prosódia PT-BR) chama o endpoint **não-oficial** da Microsoft Azure Cognitive Services Speech via biblioteca `edge-tts`. Não é API paga, não tem SLA, não tem key.

**O que pode dar errado:**
- Microsoft aperta rate limit por IP → 429/503
- Microsoft derruba o endpoint público → 404 permanente (aconteceu por semanas em 2024)
- Sua rede perde internet → timeout

**Como o sistema reage:** daemon retorna HTTP 502, Node detecta, dispara fallback automático para Fish Audio. **Zero intervenção manual necessária.** Já testado com URL bloqueada — funciona.

**Monitoramento:** se começar a ver muito fallback nos logs do Node (procurar por `↪  Fallback → 'fish'`), é sinal de que o Edge TTS está instável. Aí vale investigar.

### 3. Conda env `chatterbox` agora tem pacotes extras

Durante a integração instalamos em `/home/nmaldaner/miniconda3/envs/chatterbox/`:
- `fastapi`
- `uvicorn[standard]` (traz uvloop, httptools, watchfiles, websockets, python-dotenv)
- `edge-tts`

Nenhum desses altera o comportamento do Chatterbox em si. Mas se um dia rodar `pip list` ou `pip freeze` no env e estranhar, é esse o motivo.

**Importante:** esse env é **compartilhado com o inemavox** (o projeto original que usa Chatterbox pra dublagem). Qualquer `pip install --upgrade` nesse env afeta os dois projetos. Tratar como infraestrutura — não mexer sem avisar.

### 4. Não alteramos o código de gatilhos/pipeline

Nenhum script em `prj/inema/`, `pipeline/`, `telegram/` foi modificado. A troca do default TTS acontece via `getBestProvider('tts')` em `media/providers.js:PREFERRED_TTS_ORDER`, que agora retorna `chatterbox-vc` automaticamente.

**Consequência:** qualquer lugar do código que chama `generateSpeech(texto, saida)` **sem passar `provider` explicitamente** agora usa Chatterbox VC com voz Rachel. Se você quiser reverter globalmente, basta mudar a ordem em `PREFERRED_TTS_ORDER` (colocar `fish` antes).

**Consequência 2:** lugares que chamam `generateSpeech(texto, saida, { provider: 'fish', voiceId: '...' })` **continuam usando Fish**. Rollout seguro por padrão.

### 5. Daemon precisa estar no ar antes do pipeline rodar

Se o daemon não estiver rodando, o Node faz **2 tentativas com backoff** (ECONNREFUSED → retry 200ms-2s → retry), e só depois cai no fallback. Isso custa ~4-5s por narração durante a janela de falha.

**Como garantir que está no ar:**
- Rodando via pm2 (app `mkvideos-tts-daemon` em `ecosystem.config.cjs`): autorestart cuidar, modelo fica carregado 24/7
- Health check rápido: `curl -sS http://127.0.0.1:7860/health`
- No pm2: `pm2 status` mostra "online"

**Primeira inicialização pós-reboot da máquina:** daemon leva ~5-10s pra carregar o modelo. Se o pipeline disparar nesse intervalo, vai cair pro Fish nessa narração específica, depois as próximas pegam o Chatterbox. Aceitável, mas se quiser zero downtime, fazer pm2 resurrect no boot (`pm2 save && pm2 startup`).

### 6. Modelo ocupa VRAM permanentemente enquanto o daemon está de pé

~1.5 GB de VRAM ficam alocados o tempo todo. A GPU tem folga (25+ GB livre), mas vale saber:
- Se inemavox também estiver rodando com Chatterbox carregado, são ~3 GB no total
- Outros processos GPU (ex: rodar Llama local) competem pelo mesmo device

**Não é problema hoje, mas é o gatilho para:** se a VRAM começar a apertar, vale transformar o daemon em "lazy-load" (descarregar modelo após N minutos inativos, recarregar sob demanda). Hoje o ganho não compensa a complexidade.

### 7. Falhas ocasionais do Chatterbox (artefatos)

Modelos zero-shot de voice cloning **falham em ~1 de cada 20 clipes** com:
- Estalo no meio da fala
- Emenda estranha entre sentenças
- Final "comido"
- Duração errada (às vezes repete o final)

**Isso é inerente à arquitetura**, não é bug do daemon. Para produção, vale adicionar um check pós-geração:
- Duração do mp3 dentro do esperado (±20% do calculado por chars/velocidade)
- Loudness não-zero na primeira e última segundo

Se falhar esse check, **regenerar automaticamente** ou **disparar fallback pra Fish**. Não foi implementado ainda porque só vamos saber a taxa real em produção.

### 8. Rachel é o default, não muda por acaso

`media/voice-refs/rachel.wav` é o arquivo que define "como soa a voz default hoje". Se alguém sobrescrever ele (acidental ou intencional), todas as narrações futuras mudam de cor sem aviso.

**Proteções recomendadas (não implementadas):**
- Versionar os `.wav` de voice-refs no git (são pequenos, ~470 KB cada)
- Checksum SHA256 no startup do daemon, warning no log se mudar
- Comentário git-blame visível em quem mexeu

Por enquanto, tratar `voice-refs/` como read-only em produção. Mudar só em PRs explícitos.

---

## Comandos de diagnóstico rápido

```bash
# Status do daemon (pm2)
pm2 status | grep tts-daemon

# Health
curl -sS http://127.0.0.1:7860/health | jq

# Vozes disponíveis
curl -sS http://127.0.0.1:7860/voices | jq

# Gerar 1 teste manual
curl -X POST http://127.0.0.1:7860/tts/vc \
  -H 'Content-Type: application/json' \
  -d '{"text":"Teste rápido.","voice":"rachel"}' \
  --output /tmp/teste.mp3 && \
  ls -la /tmp/teste.mp3

# Logs recentes
pm2 logs mkvideos-tts-daemon --lines 50 --nostream

# Reiniciar (ao adicionar voz nova em voice-refs/)
pm2 restart mkvideos-tts-daemon

# Teste end-to-end via Node (deve gerar 2 mp3 em voice-tests/.../audio/)
node voice-tests/comparacao-rachel-2026-04-15/test-daemon.js
```

---

## Ver também

- `media/python/README.md` — arquitetura e endpoints do daemon
- `media/voice-refs/README.md` — como adicionar vozes novas
- `voice-tests/comparacao-rachel-2026-04-15/index.html` — comparação auditiva Rachel ElevenLabs vs todas as alternativas
- `ecosystem.config.cjs` — app `mkvideos-tts-daemon` (pm2)
- `media/tts-generator.js:generateChatterboxVC()` — cliente HTTP Node
- `media/tts-generator.js:generateSpeech()` — wrapper com fallback automático
- `media/providers.js:TTS_FALLBACK` — mapa de fallback
- **`/home/nmaldaner/projetos/ivox2/como-resolver-o-problema.md`** — explica por que usamos Chatterbox VC (pipeline duas etapas) e não Chatterbox TTS puro (bug `sdpa`/`output_attentions` com transformers recente)
