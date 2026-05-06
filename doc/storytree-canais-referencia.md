# Storytree — Referências de Canais YouTube (imagem estática + motion cinematográfico)

> Pesquisa de campo executada em 2026-05-06. Base pra factory **storytree** — vídeos de história gerados via IA com imagens estáticas + motion. V2.5 do darkstory ficou fraco; este relatório dissecta 5 canais TOP pra extrair vocabulário técnico replicável em ffmpeg/Remotion.

---

## Sumário executivo

| # | Canal | Subs | Pegada | Move signature | Replicabilidade |
|---|---|---|---|---|---|
| 1 | **LEMMiNO** | ~12M | Mistério/desaparecimentos | Push-in lento ease-out exponencial + border reveal | Alta (ffmpeg+Remotion); 3D maps exigem Mapbox/Blender |
| 2 | **Nexpo** | ~3M | Lost media / horror digital | 3D PNG layer tilt 5-10° eixo Y/X (não é parallax) | Alta — `transform: perspective(800px) rotateY()` no Remotion |
| 3 | **Bedtime Stories** | ~3.5M | Paranormal/casos históricos | Slow zoom ultra-controlado 100→115% em 8-15s | **Mais alta — ~80% só com ffmpeg + grain overlay** |
| 4 | **melodysheep** | ~3.2M | Cosmologia épica | Money shot: explosão de escala instantânea + pull-back | Média — parallax real exige Blender ou DepthFlow |
| 5 | **hochelaga** | ~750K | Manuscritos/oculto histórico | Push-in 100→400% sincronizado a frase/palavra | Alta — exige Whisper word-level + assets ≥3000px |

**Decisão técnica:** começar replicando **Bedtime Stories** (estética alcançável) + **hochelaga** (timing palavra/move). LEMMiNO e Nexpo entram numa segunda fase. Melodysheep tem pedaços (money shot, beat sync) que dão pra roubar mas o parallax 3D real exige outra stack.

---

## 1. LEMMiNO — ~12M subs

### Estilo visual
- Paleta escura dessaturada com acentos vermelho-escuro/teal
- Vignette permanente em quase todo frame (força o olho ao centro)
- Tipografia geométrica sans-serif (Montserrat-like), all-caps em títulos
- **Border reveal** (linhas finas animadas via máscara, ease-out 0.4-0.8s) — assinatura mais copiada do canal
- Mapas vetoriais com rotas desenhadas progressivamente (stroke-dashoffset) + câmera 3D real (Cinema 4D/Blender)

### Tom narrativo
- Narração em primeira pessoa analítica, nunca sensacionalista (David Wångstedt, sotaque sueco neutro)
- Cadência pausada com micro-silêncios deliberados de 1-2s
- Trilha Epidemic Sound + originais ("Aloft", "Encounters") — escalada por camadas (drone → percussão → densidade)
- Conclusões abertas/anticlimáticas — frustração produtiva, loop de rewatch

### Conteúdo
Documentários investigativos 15-100 minutos. MH370 levou 7 meses solo. Estrutura invariável: contexto → investigação cronológica → teorias → análise crítica → estado atual.

### 5 vídeos exemplares com timestamps

**Cicada 3301: An Internet Mystery** (`youtu.be/I2O7blSSzpI`, 18min)
- 0:00-0:30: push-in lento sobre tela de computador, ease-out exponencial 8s — movimento só percebido no fim
- 2:15: border reveal em screenshot de fórum, 0.6s, marca primeira aparição do puzzle
- 5:40: pan horizontal lento sobre mapa 4-5s, narrador lista localizações
- 10:20: freeze frame + zoom-in 0.3s + hold 3s — câmera "aponta" detalhe
- 14:50: pull-back suave 3s no clímax narrativo

**The Vanishing of Flight 370** (`youtu.be/kd2KEHvK-q8`, 30min)
- 1:10: câmera 3D voando sobre oceano (C4D/Blender), bezier 6-8s
- 4:30: push-in sobre mapa de radar com linha de rota se desenhando em sincronia com a fala
- 8:00: pan com **parallax de 2 layers** (mapa fundo + overlay texto, velocidades diferentes), 4s
- 15:20: **hard cut + zoom instantâneo** em detalhe — sublinha impacto
- 22:00: pull-back lento + fade preto, transição de capítulo

**Extraordinary Until Proven Otherwise** (`youtu.be/SpeSpA3e56A`, 25min)
- 3:20: modelo 3D do F/A-18 rotacionando lentamente 8s — substitui imagem estática
- 7:15: zoom-in em frame UFO + border reveal no detalhe destacado simultâneo
- 18:00: freeze + push-in 0.4s + hold 3.4s no clímax analítico

**Kennedy Assassination** (`youtu.be/5u7euN1HTuU`, 98min)
- 28:00: câmera 3D Blender reconstruindo linha de tiro, arco bezier 8-10s
- 45:00: **whip-pan simulado** (motion blur radial + corte) <0.5s — único desvio da cadência lenta

**Consumed by the Apocalypse** (`youtu.be/nx2-4l4s4Nw`, 27min)
- 6:00: zoom-in em simulação de mapa de impacto nuclear (Nukemap), ease-out 4s
- 14:00: border reveal em gráfico de probabilidade 0.7s — marca chegada de informação

### Padrão consistente
- **Move signature:** push-in lento com ease-out exponencial em imagem estática, 100% → 108-115% em 5-8s
- **Sync narração/move:** move começa quando narração apresenta o elemento — câmera = dedo apontador
- **Shot duration média:** ~6s (significativamente maior que YouTube médio de 2-3s)
- **Transição:** corte seco em 95% dos casos, dissolve apenas em transição de capítulo
- **Truque único:** border reveal como "apresentação formal" de evidência (sem zoom grotesco, sem seta)

### Replicabilidade ffmpeg/Remotion
**100% replicável:** push-in/pull-back (zoompan + bezier), pan (zoompan x variável), parallax 2-layer (overlay com velocidades diferentes), border reveal (SVG strokeDashoffset no Remotion), vignette (vignette filter), freeze + push (ss + zoompan), fade preto.
**Lacuna real:** mapas 3D reais — aproximável com Mapbox GL via Playwright gerando frames + zoompan.

---

## 2. Nexpo — ~3M subs

### Estilo visual
- Paleta dark dessaturada com acento vermelho saturado quase identitário
- **Grain + vignette permanentes** como camada base de atmosfera (não pontuais)
- Tipografia serifada pesada all-caps em title cards
- **3D PNG layer** como movimento principal — imagens importadas como layers PNG em AE com 3D ativado, rotação sutil de eixo Y/X (5-10°). Não é parallax 2.5D, é tilt/orbit do plano único.
- **TV mockup / monitor CRT** como container narrativo ("você vê o que eu vejo na tela")

### Tom narrativo
- Voz calma cadenciada, nunca hype — contraste entre voz tranquila e conteúdo perturbador
- Pacing 3 atos por segmento (setup → escalada → clímax silencioso)
- Música ambient/dark ambient, **fade out completo antes de momentos de impacto**
- **Som de projetor de slides** sincronizado com dip to black entre segmentos
- Dip to black como pontuação (0.5-2s) — transição dominante

### Conteúdo
Série "Disturbing Things from Around the Internet" — 5 artefatos analisados por vídeo, 25-45 min cada. Análise de artefatos reais com pesquisa, não horror criativo. 1-2 uploads/mês.

### 5 vídeos exemplares com timestamps

**Disturbing Things Vol.5** (`youtu.be/hVmss4uqUjs`, 30min)
- 2:00: slow push-in no 3D PNG do screenshot, AE camera 1.0→1.15x em 8-10s, ease-out
- 5:30: hard cut + zoom instantâneo no detalhe perturbador + hold 3-4s
- 7:00: TV mockup com static overlay sobre clip — frame estático 15-30s
- 8:30: dip to black 1.5s + som de projetor

**Disturbing Things Vol.13** (`youtu.be/tExo3ovEBWQ`, 35min)
- 3:00: **3D tilt lento** — rotação 5-8° eixo Y do PNG em 10s, ease-in-out
- 10:00: **push-in progressivo por cortes discretos** (não zoom contínuo) 3-5s/shot — escalada de tensão
- 18:00: freeze frame + grain amplificado + fade preto, freeze 2-3s

**Fear of the Deep** (`youtu.be/2N0jtSW9kwg`, 39min)
- 0:00-1:30: **black screen hold com áudio só** 10s, depois ultra-slow push-in 1.0→1.05x em 20s
- 15:00: comparação por hard cut entre criatura pequena e gigante — impacto cognitivo, sem zoom
- 35:00: **música some completamente + silêncio + fade preto 3s** — clímax por vácuo

**The Darkest Lost Media Vol.1** (`youtu.be/KZbzIf_C6Y4`, 40min)
- 4:00: 3D PNG tilt + slow push **combinados** simultaneamente, 12-15s
- 12:00: imagem pixelada com zoom que deliberadamente NÃO revela detalhes (preserva mistério)
- 38:00: pull-back virtual 1.1→1.0x em 8s simultâneo com fade preto

**What are The Walten Files?** (`youtu.be/a82AKDKPNg8`, 25min)
- 3:00: pause + zoom in 1.3x em 3s + hold 5s no detalhe do frame
- 18:00: hard cut → zoom extremo 1.5x+ → hold 4s → fade preto, easing quase linear (brusco intencional)

### Padrão consistente
- **Move signature:** 3D tilt de PNG layer (5-10° eixo Y/X) — único no gênero
- **Sync móvil:** narração ativa = move lento quase imperceptível; pausa = hard cut/freeze
- **Shot duration:** 8-15s com 3D tilt; 2-5s pós-revelação; 0.5-3s freeze de impacto
- **Transição padrão:** dip to black + áudio de projetor (whip-pan e match cut **não existem** no Nexpo)
- **Truque único:** **silêncio absoluto antes do clímax** (oposto da maioria) + dip to black = vácuo

### Replicabilidade ffmpeg/Remotion
**90% replicável.** O 3D tilt vira `transform: perspective(800px) rotateY(5deg)` animado com `interpolate()` no Remotion (não é o mesmo que AE 3D layer mas visualmente comparável). Vignette + grain triviais no ffmpeg. TV mockup = PNG transparente com overlay. Som de projetor + dip = afade + fade. **Único gap:** animações de texto sofisticadas em title cards — pré-renderizar como template.

---

## 3. Bedtime Stories — ~3.5M subs

### Estilo visual
- **Paleta estrita B&W** com punctuação cromática (sangue/olhos brilhantes em vermelho-escuro)
- **Arte proprietária de Mikey Turcanu** — não stock; carvão digital com sombras densas
- **Sem tipografia no frame** durante cenas de ilustração — identidade 100% no áudio + arte
- Sem UI/HUD — limpeza total, sem logo persistente
- **A partir da temporada 5** — micro-animações em layer separada (lanternas, fumaça, ondas)

### Tom narrativo
- **Richard While**, britânico barítono, dicção documental, ritmo lento (mais lento que YouTube médio)
- **Postura de ceticismo investigativo** ("allegedly", "reportedly", "according to witnesses") — distância jornalística amplifica horror
- Pico emocional dito quase baixinho — peso cai no silêncio
- **Música:** Kevin MacLeod + CO.AG ("Ice Demon", "Crypto", "Undaunted") — drones atmosféricos, texturas não trilhas
- **Zero stingers/jump scares sonoros** — tensão por contenção

### Conteúdo
Casos paranormais, desaparecimentos, mortes inexplicáveis. Hinterkaifeck, Lake Michigan Triangle, Skinwalker Ranch. 15-25 min. Sem entrevistas, sem cortes pra apresentador, sem gráficos. Narração + arte. Densidade alta, zero relleno.

### 5 episódios exemplares

**The Disappearance of the Nanjing Battalion** (`youtu.be/E79pWNSw7WM`, 20min) — outlier visual
- 0:00-1:30: slow zoom 100→115% em paisagem montanhosa, ease-in-out **quase imperceptível** 8-10s
- 2:00-4:00: **drawstroke animation** (figuras desenhadas em tempo real, apagadas com borracha quando somem)
- 8:00-10:00: pan lateral lentíssimo 5% horizontal em 12s — floresta "fecha" em torno
- 15:00-17:00: arte estática, câmera **para 3s** sincronizada com silêncio narrativo

**Tales from Skinwalker Ranch Part Three** (`youtu.be/PryJXlnBT8o`, 22min)
- 0:00-2:00: zoom slow 100→120% no celeiro, 10s
- 5:00-7:00: pan diagonal 3% em 15s no céu estrelado
- 12:00-13:00: **lanterna oscila** (loop senoidal 2-3 frames de amplitude, layer separada)
- 18:00-19:00: **cross-dissolve longo 1.5-2s** entre shots — transição padrão

**The Mysterious Murders of Hinterkaifeck** (~18min)
- 0:00-1:30: zoom 100→118% centrado em janela iluminada, 12s
- 4:00-6:00: tilt-down virtual 4% em 10s sobre interior
- 9:00-11:00: **reverse zoom 115→100%** no celeiro — recuo no horror máximo
- 14:00-15:00: cross-dissolve para foto de arquivo real anos 1920 — choque B&W estilizado vs foto real

**Skinwalker Ranch Part One** (`youtu.be/31a3DGLiB48`, 24min)
- 0:00-3:00: shot **15s** de slow zoom (mais longo que habitual) — estabelece escala
- 11:00-13:00: **compound pan+zoom** (2% horizontal + 3% zoom em 12s) — move mais cinematográfico do canal
- 20:00-22:00: 3 shots em sequência com cross-dissolves 2s cada — fechamento de subcapítulo

**Lake Michigan Triangle**
- Slow zoom centrado em Y baixo (linha do horizonte), 10-12s
- Vignette progressiva (frame escurece nas bordas conforme zoom avança)
- Silêncio de 3s no pico — sem música, sem motion

### Padrão consistente
- **Move signature:** slow zoom 100→115-130% em 8-15s, ease-in-out muito suave
- **Easing:** aceleração e desaceleração imperceptíveis, nunca snap
- **Shot duration:** 8-15s típico; 4-6s só em sequências de clímax; 20s+ apenas establishing
- **Transição padrão:** **cross-dissolve 1.5-2.5s** (NUNCA corte seco entre ilustrações; corte seco apenas pra footage real)
- **Micro-animações em layer separada:** lanterna senoidal 2-3 frames, água em loop, fumaça/névoa em floresta

### Replicabilidade ffmpeg/Remotion
**~80% só com ffmpeg.** Slow zoom `zoompan=z='min(zoom+0.0008,1.3)':d=360`. Cross-dissolve `xfade=transition=dissolve:duration=2`. Grain temporal `noise=c0s=12:c0f=t+u`. Vignette progressiva `vignette=PI/4`. B&W `colorchannelmixer`. **Restante 20% (lanterna oscilando, fumaça, água) exige Remotion** com `<Img transform: rotate(${Math.sin(frame * 0.1) * 3}deg)>` ou loop de vídeo de fumaça em blend `screen`. **Crítico:** pré-scale a imagem para 2x output (gerar 2160p pra render 1080p) pra zoom não pixelar.

---

## 4. melodysheep — ~3.2M subs

### Estilo visual
- **Paleta cosmológica fria-quente** — teal/cyan dominante (nebulosas), laranja/âmbar concentrado (estrelas, explosões). Orgânico, não LUT.
- **3 camadas de fontes:** (a) footage NASA/ESA ultra-HD, (b) concept art científico, (c) CG 3D Octane (buracos negros, era degenerate)
- **Motion blur pesado em CG** (~180° shutter) — funde com NASA footage que tem motion blur natural
- **Compositing por luminância** — Screen/Add blend, halos se fundem sem borda dura

### Tom narrativo
- **Antigos:** autotune de cientistas (Symphony of Science). **Modernos** (2019+): Boswell em primeira pessoa, voz grave, ritmo lento, pausas longas
- Postura: **sublime, não catastrofista** — mesmo descrevendo fim do universo, tom de maravilhamento
- **Ritmo de narração ditado pela música** — voz some quando música sobe, silêncio narrativo é o pico
- **Texto-imagem editado como lírica** — corte cai no fotograma da supernova quando diz "estrelas vão morrer"
- **Contador de tempo como protagonista silencioso** — aceleração do contador é tensão dramática

### Conteúdo
Documentários cosmológicos 4K, 10-75min. Cadência lenta (1-3 vídeos/ano, 6-12 meses produção). Cosmologia, astrobiologia, deep time existencialista. Views entre 20M e 110M cada.

### 5 vídeos exemplares

**TIMELAPSE OF THE FUTURE** (`youtu.be/uD4izuDMUQA`, 29min)
- 0:00-0:45: slow push-in 100→130% em foto Terra, ease-in cubic 8s, narração "We begin in the present"
- 2:10-2:30: corte para CG Terra+Lua, **órbita arco 90° linear suave 20s**, string pads, sem beat
- 5:40-6:00: **MONEY SHOT supernova** — escala explode 100→600% **em 3 frames (~0.1s)** + pull-back gradual 4s, hit de percussão
- 12:30-13:00: **cross-dissolve rítmico 4× 1s sincronizado a arpejo de sintetizador** (4 notas = 4 cuts)
- 24:00-25:00: shot ultra-longo 60s buraco negro CG, câmera **imóvel**, objeto em rotação cria ilusão de push

**LIFE BEYOND I** (`youtu.be/SUelbSa-OkA`, 30min)
- 1:20-1:45: pan horizontal lento 5%/s em ilustração planeta oceânico 15s
- 9:00-9:20: **2.5D parallax real** em concept art (fg vegetação roxa mais rápido que bg céu laranja), 12s
- 18:00-18:30: **orbit shot 180° Blender** em criatura, bezier 30s
- 27:00-27:20: **pull-back cosmológico em série de cross-dissolves** — célula → planeta → galáxia, dissolves 1.5s

**LIFE BEYOND II** (`youtu.be/ThDYazipjSI`, 48min)
- 22:00-22:30: 5 concept arts com push-in leve 110→120% + dissolve 3s entre cada
- 41:00-41:40: **shot mais longo do canal** — galáxia girando 40s, câmera estática, drone bass profundo

**LIFE BEYOND III** (`youtu.be/l2_GIiF9tNk`, 1h15min)
- 3:00-3:20: shot Blender **55s** com 7 criaturas + megaestrutura, orbit contínuo sem cortes
- 28:00-28:30: **parallax real** assets Blender em Z separados (fg estrutura mais rápido que bg nebulosa) 20s
- 1:02:00-1:03:00: deep time — contador acelera, dissolves rápidos, beat sobe 60→120bpm

**TIMELAPSE OF THE ENTIRE UNIVERSE** (`youtu.be/TBikbn5XJhg`, 10min)
- 0:05-0:30: **Big Bang** — flash branco + zoom-out explosivo 500→100% em 0.5s + pull-back ease-out 6s
- 5:30-5:50: **8 cuts em 10s sincronizados em cada 16th note** do beat eletrônico 120bpm
- 9:30-10:00: pull-back final 100→5% revelando Via Láctea como pixel em fundo CMB, ease-out **30s extremamente lento**

### Padrão consistente
- **Parallax real só em 3D Blender/C4D** (fg/mg/bg em Z distinto). Pra fotos 2D, **pseudo-parallax** (zoom 2-5% no shot, ilusão sem profundidade real).
- **Música composta primeiro sempre** — Ableton 120bpm como metrônomo de edição. Cortes de ação caem no downbeat, narrativos no meio do compasso.
- **Shot duration bimodal:** 3-5s (informativo) ou 10-25s+ (contemplativo) — nada no meio (6-12s é o intervalo menos comum).
- **Money shot estrutural:** suspense imóvel 5-10s → escala explode 2-5 frames → flash/corte → pull-back suave 3-8s. Easing **quasi-instantâneo**, percebido como impacto físico. Um por episódio.
- **Stack:** Cinema 4D + Octane, AE, Premiere, Ableton, Blender (Life Beyond II/III), Spitfire/8dio/Omnisphere (orquestra), Moog Sub-37 (bass).

### Replicabilidade ffmpeg/Remotion
- **ffmpeg:** Ken Burns com easing custom (zoompan + expressões matemáticas), money shot (keyframe scale 2-3 frames + flash overlay `blend=addition`), cross-dissolves `xfade`. **NÃO faz parallax 3D real** — só pseudo (overlay com velocidades diferentes).
- **Remotion:** `interpolate()` com `Easing.bezier()` qualidade AE. Beat sync via Python+librosa → JSON timestamps → frame numbers no Remotion. Money shot trivial.
- **Parallax 2.5D real:** **DepthFlow** (Python + GLSL + MiDaS/ZoeDepth) gera depth map e renderiza deformação por shader. Alternativa: **3 prompts pareados de IA** (fg sem bg, mg, bg separados) = mais controle criativo, sem ML.
- **Orbit 3D shot estilo Life Beyond:** exclusivo de Blender/C4D ou `@remotion/three`.
- **Esforço:** zoom easing 1d, beat sync 2-3d, money shot trivial, parallax 2.5D 1-2 semanas, orbit 3D = só Three.js no Remotion.

---

## 5. hochelaga — ~750K subs

> **Aviso metodológico:** YouTube bloqueia transcrição automatizada deste canal e não há making-of disponível. Análise abaixo combina dados verificáveis (thumbnails, identidade do narrador, escolha de assets) com inferência fundamentada baseada em padrão de canais do mesmo gênero. Tratar como hipótese de replicação, não ground truth frame-perfect.

### Estilo visual
- **Assets de altíssima resolução** de acervos públicos (Europeana, British Library Digital, Wellcome, Internet Archive, Gallica/BnF) — 3000-6000px habilitam push-in 400% sem artefato
- Paleta desaturada com vinheta suave, sépia/preto/carvão/pergaminho amarelado
- Tipografia serifada ou manuscrita em fundo escuro
- **Sem motion graphics 2D** — todo visual é imagem estática em movimento controlado
- **Composição: ocupação total do frame** — manuscritos como "câmera dentro de um mundo", não elemento flutuante

### Tom narrativo
- **Tommie Trelawny** (Edinburgh + Cambridge) — britânico RP com inflexão acadêmica, "professor de Oxford contando história de bar bizarra"
- Ritmo lento-médio, pausas retóricas
- Postura: **descoberta compartilhada** ("o que é curioso sobre este manuscrito é..."), não autoridade definitiva
- Som ambiente sutil — cordas, scriptorium ambience, sem jump scares
- Estrutura: contexto → anomalia → análise → **conclusão aberta** (clímax visual no meio-final, não no final)

### Conteúdo
Anomalias históricas obscuras: manuscritos não decifrados (Voynich), iconografia religiosa perturbadora (anjos bíblicos), arte grotesca medieval (Drolatic Dreams), ocultismo pré-moderno. 8-20min. 750K+ subs, 48M+ views, longevidade algorítmica alta (vídeos de 2020 ainda gerando views).

### 5 vídeos exemplares

**The Demon Doodles of 1565** (`youtu.be/ejg8eA4yIG4`)
- 0:00-0:08: reveal lento de gravura, **150% → 100% pull-out** revela composição completa, ease-in-out 8s
- 1:30-2:00: **push-in 100→250%** em face grotesca, ease-out 4-6s, narração descreve criatura no momento exato — **zoom = dedo apontando**
- 3:00-3:30: pan horizontal em prancha múltipla, ~200px/s em asset 4000px — sensação de "percorrendo galeria"
- 5:00: **jump cut comparativo** entre demônio medieval cornudo e representação séc XVIII
- 7:30: **push-in 100→350% em texto inscrito**, hold 3-4s enquanto narração lê

**The Dark Side of Nursery Rhymes** (`youtu.be/K2oINoMTO2Q`)
- 0:00-0:15: **letterbox progressivo** (faixas pretas entram cima/baixo em 8s, 2.35:1) + slow pull-out 120→100% — frame "vira cinema"
- 2:00-2:30: pan E→D em ilustração que não cabe no frame, velocidade constante — sensação de "leitura"
- 4:30: push-in 100→200% em rosto da criança quando narração revela interpretação sombria, ease-out 5s
- 6:00: freeze + text card com info factual, hold 4-6s

**Secrets of the Voynich Manuscript** (`youtu.be/CSYXCBqGcZo`)
- 1:00-1:30: pan vertical em página de plantas, ~300px/s em asset 4000px
- 3:30: **push-in extremo 100→400% em glifo**, ease-out 1.5s + hold 5s — assinatura do canal
- 6:00: comparativo side-by-side entre dois manuscritos medievais
- 8:00: **money shot** — pull-out 300→100% revelando mapa cosmológico circular completo, 8-10s

**Why Bible Accurate Angels Are So Creepy**
- 2:00: push-in 100→250% em "Ophanim" (roda cheia de olhos) — **olhos individuais surgem conforme zoom avança**, sincronizado com narração lendo Ezequiel linha a linha
- 4:30: pan panorâmico em mosaico de abside (asset muito largo) 10-15s velocidade uniforme
- 5:30: **corte abrupto wide → close extremo** em detalhe perturbador, zero motion, pausa 3s

**The Oldest (Known) Song of All Time** — tábua cuneiforme Hitita
- 0:00: pull-out 400→100% de cunha cuneiforme única revelando tábua completa, 12s — coincide com "Somewhere around 1400 BCE..."
- 2:00: pan horizontal seguindo linha de escrita — movimento mimético de leitura
- 5:00: freeze com overlay de partitura moderna sobre tábua

### Padrão consistente
- **5 moves principais:** push-in (alta freq), pull-out (média, abertura/clímax), pan horizontal (alta), pan vertical (média), hold estático em zoom máximo (alta)
- **Move signature:** push-in 100→200-400% sincronizado a frase/cláusula da narração
- **Sync narração/move:** **NÃO é frame-perfect palavra-por-palavra** (ritmo retórico de Trelawny é mais lento) — é por **frase ou cláusula**. Simplifica implementação: não exige Whisper word-level, basta frase-level.
- **Letterbox:** uso confirmado em abertura e transições — faixas 0→10-13% em ~4s ease-out
- **Asset não-negociável:** ≥2048px (idealmente 3000-6000px) pra suportar push-in 400% sem pixelação
- **Shot duration:** 6-12s típico, raramente <4s (exceto cortes comparativos)
- **Jump cut comparativo** sem transição — impacto cognitivo

### Replicabilidade ffmpeg/Remotion
**Tudo trivial técnicamente:** push-in/pull-out (zoompan + Easing.easeInOut), letterbox (drawbox no ffmpeg ou AbsoluteFill com height animation no Remotion), pan (zoompan x dinâmico), hold (zoompan zoom=4:d=150).
**O que exige trabalho:**
- **Sync frase/zoom:** Whisper (qualquer versão) ou WhisperX para timestamps de frase → JSON cues → Remotion keyframes
- **Push-in 400%:** source ≥4× output (4320px pra 1080p output) — Europeana/BnF resolvem
- **Easing não-linear ffmpeg:** zoompan só tem linear nativo; ease-in-out exige pré-cálculo via script
**Gap real do storytree:** não é técnico, é **orquestração** — sistema de cues `[timestamp, asset, region_of_interest, move_type, duration, narration_cue]` gerado por LLM a partir do script. Esse plano é o que transforma Ken Burns genérico em hochelaga.

---

## Padrões universais — o que os 5 fazem e o darkstory NÃO faz

1. **Move é editorial, não decorativo** — começa exatamente quando narração apresenta o elemento, termina antes do próximo beat. Câmera = dedo apontador. Nunca "rodando à toa entre beats". (Confirmado em todos 5: LEMMiNO, Bedtime, hochelaga explícitos; Nexpo via narração-ativa-vs-pausa; melodysheep via lyric editing.)

2. **Easing não-linear consistente** — ease-out exponencial (LEMMiNO), ease-in-out cubic (melodysheep), ease-out (hochelaga, Nexpo), ease-in-out muito suave (Bedtime). **Nenhum dos 5 usa zoom linear.** ffmpeg `zoompan` linear é insuficiente — precisa de expressões matemáticas pré-calculadas ou Remotion `Easing.bezier()`.

3. **Camada de textura/grain permanente** unificando assets heterogêneos — vignette + grain (LEMMiNO, Nexpo, Bedtime), motion blur (melodysheep), textura de carvão na arte base (Bedtime). Equivalente a um LUT de identidade visual.

4. **Shot duration variável e bimodal** — estabelecimento/contemplativo 8-15s, detalhe/clímax 1.5-5s, money shot único 30-60s. **Nada no meio (6-8s) é o intervalo menos comum em melodysheep.** Mudança de velocidade deliberada a cada ~90s (hard cut, fade preto, zoom out de escala).

5. **Trilha + edição interligadas** — música composta primeiro (melodysheep, LEMMiNO usa Epidemic curado), beat sincroniza cuts (melodysheep 16th notes, LEMMiNO drone+percussão). Bedtime e hochelaga usam **silêncio como trilha** — pico emocional sem música.

6. **Transição padrão é minimalista** — 95% corte seco (LEMMiNO), dip to black (Nexpo), cross-dissolve longo 1.5-2.5s (Bedtime), corte seco direto (hochelaga). **Whip pan e match cut quase inexistem** — só LEMMiNO usa whip-pan simulado entre capítulos.

7. **Truque de "silêncio antes do clímax"** — Nexpo é o mais explícito (música some 3-5s antes do momento mais perturbador), mas Bedtime e LEMMiNO também fazem versões. Vácuo > stinger.

---

## Aplicação ao storytree — priorização técnica

### Tier 1 — implementar primeiro (alcançável em dias)

| Item | Stack | Esforço | Impacto |
|---|---|---|---|
| Easing curves explícitas (ease-out exp, ease-in-out cubic, bezier) em `lib/camera-moves.js` | ffmpeg zoompan com expressões pré-calculadas OU migrar move pra Remotion | 1-2d | Alto — todos os 5 canais usam não-linear |
| Grain temporal + vignette permanente como camada global | ffmpeg `noise=c0s=12:c0f=t+u` + `vignette=PI/4` | 0.5d | Alto — unifica assets heterogêneos |
| Shot duration variável por papel da cena (estabelecimento 8-15s, detalhe 2-5s, clímax 1.5-3s) | Editar `gen-darkstory-cinematic.js` pra Claude gerar `shot_role` por shot | 0.5d | Alto — quebra a sensação de slideshow uniforme |
| Cross-dissolve longo 1.5-2.5s entre shots (estilo Bedtime) | ffmpeg `xfade=transition=dissolve:duration=2` | 0.5d | Médio — opcional por cena |
| Letterbox progressivo (faixas 0→13% em 4s ease-out) | ffmpeg `drawbox` ou Remotion AbsoluteFill | 1d | Alto — gesto cinematográfico forte |
| Pré-scale 2x dos assets (gerar 2160p pra render 1080p) — push-in 200% sem pixelar | Ajustar prompt do inemaimg pra resolução máxima | 0.5d | Crítico — sem isso o zoom borra |

### Tier 2 — exige Whisper word/phrase-level (1-2 semanas)

| Item | Stack | Impacto |
|---|---|---|
| Word/phrase-level timestamps via WhisperX → JSON cues `[timestamp, asset, ROI, move, duration, cue]` | WhisperX + script de cue generation (LLM analisa narração + asset, decide ROI) | **Crítico** — é o que transforma Ken Burns em hochelaga |
| Sync move com palavra-chave (LEMMiNO, hochelaga) | Cues alimentando keyframes do zoompan/Remotion | Crítico |
| Border reveal no estilo LEMMiNO | SVG strokeDashoffset no Remotion | Alto |
| 3D PNG tilt no estilo Nexpo | `transform: perspective(800px) rotateY(${interp}deg)` no Remotion | Alto |

### Tier 3 — pesquisa/setup mais pesado (semanas)

| Item | Stack | Impacto |
|---|---|---|
| Parallax 2.5D real (estilo melodysheep) | **DepthFlow** (MiDaS/ZoeDepth + GLSL shader) OU 3 prompts pareados de IA (fg/mg/bg separados) | Médio — money shot, não cada cena |
| Money shot — explosão de escala instantânea + flash + pull-back | ffmpeg keyframe scale 2-3 frames + `blend=addition` overlay | Alto — climax único por vídeo |
| Beat sync automático (cortes em downbeat, narrativos no meio do compasso) | Python + librosa beat detection → JSON timestamps → Remotion keyframes | Médio — exige música composta primeiro |
| Mapas 3D (estilo LEMMiNO) | Mapbox GL via Playwright gerando frames OU Blender | Baixa prioridade pra storytree de história/ação |
| Micro-animações em layer separada (lanterna oscilando, fumaça, água) | Remotion `<Img transform: rotate(${Math.sin(frame*0.1)*3}deg)>` ou loop de vídeo blend `screen` | Médio — diferencial Bedtime |
| Orbit 3D shot real (estilo Life Beyond) | `@remotion/three` + Three.js, ou Blender batch render | Alto custo, alto impacto pontual |

### Recomendação de ataque imediato

Começar com **Tier 1 inteiro** (4-5 dias dev) + **WhisperX integration do Tier 2** (1 semana). Isso já elimina o "slideshow Ken Burns" e entrega vocabulário Bedtime+hochelaga combinado. Money shot e parallax 2.5D ficam pra v3 do storytree.

---

## Fontes (consolidadas)

**LEMMiNO:** lemmi.no/faq, vediting.home.blog (CapCut tutorial), `youtu.be/UXs8FUu4Ako` (Animate Like Lemmino AE tutorial), `youtu.be/WndmHbnHsl4` (Border Reveal AE tutorial), `youtu.be/BYBuHQeVBuY` (3D Path Animation), `youtu.be/069_DWslXJI` (Make Maps Like LEMMINO).

**Nexpo:** r/editing thread "How to edit like Nexpo", Wikitubia/Nexpo, teensinprint.com (Fear of the Deep análise), pickscribe.com (transcript Fear of the Deep).

**Bedtime Stories:** Wikitubia/Bedtime Stories, TV Tropes/BedtimeStoriesYouTubeChannel, archive.org Nanjing Battalion, vocal.media/horror.

**melodysheep:** asoundeffect.com (sound design), evanlecy.com/melodysheep-the-new-education, melodysheep.com/life-beyond, blendernation.com, artstation.com/Igor-Puskaric (creature design), waxy.org/2019/11 (parallax 2.5D ML), github.com/BrokenSource/DepthFlow.

**hochelaga:** noxinfluencer.com analytics, newsletter.podcastdelivery.com (Q&A Trelawny), IMDb/Tommie-Trelawny, similarchannels.com/c/hochelaga.

**Stack:** ayosec.github.io/ffmpeg-filters-docs (zoompan), bannerbear.com (Ken Burns ffmpeg), creatomate.com (zoom images ffmpeg), github.com/scriptituk/xfade-easing, github.com/m-bain/whisperX, motionarray.com (parallax 2.5D AE).
