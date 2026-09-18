# Third-party notices — DnB Studio

## Included in Phase 0 browser app

| Component | Role | License |
|-----------|------|---------|
| Tone.js | Preview playback of rendered WAV only | MIT |
| React / React DOM | UI | MIT |
| Vite | Bundler | MIT |
| Zustand | State | MIT |
| TypeScript | Types | Apache-2.0 |
| Vitest | Tests | MIT |
| tsx | Runs `scripts/listening-set.mjs` | MIT |

## Bridge runtime (user-installed, optional)

| Component | Role | License |
|-----------|------|---------|
| Demucs v4 (`htdemucs`) | Real stem separation behind bridge `POST /stems` — optional, `pip install demucs` | MIT |
| PyTorch | Demucs/CUDA backend | BSD-3-Clause |

## Planned optional (not in Phase 0 bundle)

| Component | Role | License |
|-----------|------|---------|
| ACE-Step 1.5 | GPU generate on RTX 5080 (default DiT `acestep-v15-turbo`) | MIT |
| Stable Audio 3 | Optional textures | Stability Community License (under USD 1M revenue; register + attribution; optional only) |

See scripts/download-ace-step.md for model download.

## Forbidden

- ACE-Step-DAW / Strudel (AGPL)
- Matchering / Pedalboard (GPL-3)
- MusicGen NC / LeVo2 non-commercial cores
- Artist-name clone features
- Training on YouTube rips or third-party catalogs
