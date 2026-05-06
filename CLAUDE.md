# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**mkVIDEOS** — standalone video factory: still images + cinematic motion via ffmpeg `zoompan`. Generators (`gen-*.js`) drive the full pipeline (image gen + render); renderers (`render-*.js`) are pure ffmpeg recipes that turn an existing image set + shot plan into mp4.

CommonJS Node 18+, no build step. Single runtime dep: `dotenv`. Everything else is stdlib + shelling out to `ffmpeg`. Repo: https://github.com/inematds/mkvideos.

## Versioning rule

`v<major>.<features>.<bugs>` — display format is `v1.00.00` (zero-padded 2 digits). **Both counters are independent and never reset** — only a major bump (v1 → v2) resets them. Examples:
- v1.00.00 + new feature → v1.01.00
- v1.01.00 + bug fix → v1.01.01
- v1.01.01 + new feature → v1.02.01 (bug counter stays at 01)
- v1.02.01 + bug fix → v1.02.02

Bump the second segment for any new capability (preset, template, provider, UI feature). Bump the third for fixes that don't add capability. `package.json` stores the raw `1.0.0` (valid semver); the UI formats it for display via `ui/public/app.js#formatVersion`.

## Commands

```bash
npm run check:syntax          # node --check on every *.js (≤depth 3)
npm run ui                    # read-only campaign browser on :5178 (MKVIDEOS_UI_PORT)
npm run happy                 # gen-storytree-happy.js — full E2E demo
npm run criaprof              # gen-criaprof.js
npm run gertran               # gen-gertran-nostalgia.js
npm run darkstory:v2          # render-darkstory-cinematic-v2.js

node render-storytree-v2.js   # render only — needs imgs already in output/videos/...
node gen-<template>.js        # gen → image gen + render in one shot
```

There is no test runner. Validation runs at *render time* via `lib/storytree-qa.js` — the script aborts before invoking ffmpeg if `errors.length > 0`.

## External daemons (not in this repo)

These run as separate processes; the scripts hit them over HTTP. Configure in `.env`:

| Daemon | Default | Purpose |
|---|---|---|
| `inemaimg` | `http://localhost:8000` | Multi-model image API (FLUX.2, Qwen, ERNIE) — `~/projetos/inemaimg` |
| Chatterbox TTS | `http://127.0.0.1:7860` | Local TTS (rachel/bella) |
| `inemavox` | `http://192.168.2.99:8010` | Freesound proxy + local music/SFX library |

Image-model license matrix: FLUX.2 variants are non-commercial; Qwen/ERNIE are commercial-OK. `INEMAIMG_QUALITY=fast` (default) caps resolution at 512² for sub-minute iteration; set `=high` for final renders.

## Architecture

### gen + render split
Two layers per template:
- **`gen-*.js`** — orchestrate end-to-end: write prompts, call `pipeline/generate-image-*` to produce N PNGs, then build a shot plan and invoke the renderer.
- **`render-*.js`** — pure ffmpeg pipeline: take existing images + plan, output mp4. Each renderer hardcodes its `SRC` (input dir) and `OUT` paths near the top.

Renderers are not parameterized via CLI flags — to retarget to a different image set, edit the constants at the top of the file. This is intentional: each script is a one-off recipe, not a reusable CLI.

### `lib/storytree-*` — the v2 motion engine

The current architecture (`render-storytree-v2.js`, `render-darkstory-cinematic-v2.js`, `gen-storytree-happy.js`) is built on five composable modules. Older renderers (`render-darkstory.js`, `render-storytree-poc.js`, etc.) use the simpler `lib/camera-moves.js` and are kept as references — don't extend them, port to v2 instead.

| Module | Responsibility |
|---|---|
| `storytree-presets.js` | 16-move vocabulary (`slow_push_in`, `flash_cut`, `whip_pan`, …). Exports `PRESETS` (config), `EASING_FNS` (ffmpeg `zoompan z=` expressions), and `buildShotVF(shot, opts)` — the one function that produces the full `-vf` string (pre-scale + zoompan + grain + vignette + letterbox + flash + fade). |
| `storytree-classify.js` | Auto-derive `image_class` (`face`/`landscape`/`dark`/…) from the original prompt text. |
| `storytree-shot-schema.js` | `ShotPlan` factory — `buildPlanFromImages(images, format, totalDuration)` returns the validated plan. JSDoc typedefs are the schema source of truth. |
| `storytree-selector.js` | Double matrix `image_class × role → preset`, with `FORBIDDEN` exclusions (e.g. no `flash_cut` on `face`). Falls back to role over image when intersection is empty. |
| `storytree-rhythm.js` | Format-specific phase distribution (`short_reel`, `storytelling`, `micro_doc`) — % ranges → suggested role + shot duration. |
| `storytree-qa.js` | Pre-render validation. Returns `{ok, errors, warnings}`. Render scripts call `validateShotPlan()` and bail on errors before any ffmpeg call. |

The 8 `role` values (`hook|context|explanation|suspense|discovery|climax|rest|closing`) and 11 `image_class` values are enumerated in `storytree-qa.js` — that's the canonical list.

### Pipeline flow (storytree-style gen)
```
prompts → pipeline/generate-image-inemaimg → PNGs
                                            ↓
                            storytree-classify (prompt → image_class)
                                            ↓
                            buildPlanFromImages(format, duration) → ShotPlan[]
                                            ↓
                            validateShotPlan (abort on error)
                                            ↓
                            buildShotVF per shot → ffmpeg execSync per shot
                                            ↓
                            concat demuxer + audio mux → final mp4
```

### Image providers (`pipeline/`)
Four interchangeable providers, all expose `generateImage({outputPath, prompt, ...})`:
- `generate-image-inemaimg.js` — local daemon, default. Aspect ratios `1:1|9:16|16:9|4:3|3:4`.
- `generate-image-kie.js` — KIE.ai cloud (z-image/flux).
- `generate-image-piramyd.js` — Piramyd.
- `generate-image-pollinations.js` — free Pollinations.

`config/env.js#getDefaultImageModel(provider)` picks the right default model env var.

### Config
- `config/env.js` — thin wrapper around `dotenv` with `getEnv`/`requireEnv`/`hasEnv`/`getList`. Reads from `process.env` first, then the `.env` file. **Always use these helpers** instead of `process.env.X` directly so `.env` overrides work consistently.
- `config/profissoes-*.js` — large data tables (10–130 KB) of professions/scripts used by the CriaProf and narration templates.

### UI (`ui/server.js`, `ui/public/`)
Vanilla http server, no deps, **read-only** — never spawns, never writes. Browses `prj/<project>/outputs/<task>` campaign folders showing payload + image/video previews. Started by `npm run ui` on `localhost:5178`. The README mentions an `output/` layout, but the UI walks `prj/` (which is gitignored). When in doubt, check the actual paths in `gen-*.js` `OUT =` lines.

## Conventions worth knowing

- **Hardcoded paths.** `gen-*.js` and `render-*.js` use `const ROOT = '/home/nmaldaner/projetos/mkvideos'` literally. If you fork/move the repo, search-and-replace this. Don't try to make them portable as a side quest.
- **`.env` is real and gitignored.** It contains live API keys (Pexels, Pixabay, Piramyd, FishAudio, Freesound, OpenRouter). Don't echo its contents into chat, commits, or logs.
- **`output/videos/` and `tmp/` are gitignored** — output dirs are scratch space, not source.
- **`media/musicas/`, `media/sfx/`, `media/voice-refs/`** are not committed; populate manually for renders that mux audio.
- **Pre-scale before `zoompan`.** Renderers scale the source image to 1.5× target before zoompan to avoid per-frame interpolation artifacts. `buildShotVF` already wires this; if you build vfs by hand, do the same.
- **Comments and docstrings are in Portuguese.** New code can match or use English — both exist.

## When extending

- **New motion preset:** add to `PRESETS` in `storytree-presets.js`, then list it in `IMAGE_TYPE_MOVES` and/or `ROLE_MOVES` in `storytree-selector.js` so it gets selected. Verify `typical_dur` covers your common case so QA doesn't warn.
- **New image_class or role:** update the `ROLES` / `IMAGE_CLASSES` arrays at the top of `storytree-qa.js` (canonical list) AND add entries to the selector matrices.
- **New renderer:** copy `render-storytree-v2.js` as the template — it's the cleanest end-to-end example of the v2 module composition.
- **New aspect ratio:** add to `ASPECT_RATIO_SIZES_FAST`/`HIGH` in `pipeline/generate-image-inemaimg.js` (multiples of 64) and to `FORMATS[*].aspect` in `storytree-rhythm.js` if it needs its own pacing.

## Doc references

- `doc/storytree-canais-referencia.md` — field research on 5 YouTube channels (LEMMiNO, Nexpo, Bedtime Stories, melodysheep, hochelaga). The motion grammar in `storytree-presets.js` is derived from this. Read it before changing easing curves or preset semantics.
- `doc/comic-styles.md` — 5 comic-strip prompt suffixes used by `gen-criaprof-comic-A.js`.
- `doc/tts-daemon-notas.md` — operational notes on the Chatterbox TTS daemon (external infra, not in this repo).
