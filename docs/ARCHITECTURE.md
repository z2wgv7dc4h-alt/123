# Wyatt DnB Studio — Architecture (Phase 0/1)

**Date:** 2026-09-06 (PT / Australia·Perth)
**Product:** Local-first hybrid studio for original energetic rock-DnB / dancefloor DnB (~174 BPM).
**Phase 0 ship:** Vite + React + TS browser app with HardGridStructureEngine + OfflineStubBackend (CPU). ACE-Step GPU sidecar is fail-soft / gated.

## Hard role split

| Layer | Authority | Notes |
|-------|-----------|--------|
| IStructureEngine | Arrangement, 174 BPM hard bar grid, drums/bass plans, MIDI | Never ACE |
| IAudioBackend | Timbre / stems / mix audio only | OfflineStub now; ACE-Step 1.5 later |
| Preview | WebAudio / Tone.Player of rendered mix / remixed buffers | Tone is not the synth engine |
| Export | WAV stems + manifest JSON + Type-0 MIDI + zip; remixed Export adds mix_as_heard.wav | 48 kHz, 16-bit Phase 0 |

## Style reference (Vibe Mirror v0)

- Own-file analyze in-browser (styleRef/); owner attestation required.
- Maps vibe into OfflineStub energy/darkness/chaos bias; BPM stays 174.
- Manifest provenance: acePathActive false on OfflineStub.

## Listen / modify

- Stem mute/solo/gain via PreviewPlayer remix + glue path.
- Export: renderRemixedWavBlob → *_mix_as_heard.wav when mixer dirty; dry stems unchanged.
- UI: StemMixerCompact (Simple), full StemMixer, mixerDirty / HELP.remixLive.

## Again / Vary / Favorites / regen

- generateAgain = same seed; vary = new seed then generate.
- RegenAffordance when paramsDirty.
- Surprise Me under More. FavoritesPanel under More (browser-local storage).

## Forbidden

- Tone.js as synth engine — KILLED (preview of WAV only)
- ACE-Step-DAW / Strudel — FORBIDDEN (AGPL)
- MusicGen NC / LeVo2 / Matchering GPL / Pedalboard GPL in binary — FORBIDDEN
- Artist-clone product / catalog rips / stem RE — FORBIDDEN; style text may keep vibe words (scrubArtistNames no-op)
- Train on third-party catalogs — FORBIDDEN

## BPM lock

- Product target 174 BPM; UI band 170–176.
- Acceptance |measured − 174| ≤ 2.0 provisional (structure lock; no audio BPM meter yet).
- OfflineStub locks plan BPM to structure map.

## Backend registry

1. offline-stub — CPU Float32 sketch → real WAV blobs (legoStems false)
2. ace-step-1.5 — stub; render throws GPU required; caps aspirational until sidecar live

BackendRegistry.selectBest keeps OfflineStub until AceStep probe reports hasGpu.

## LoRA / provenance

Browser LoRAPackManager: metadata + gates only. Stub packs until CUDA train path.

## Stem schema (A3 / stem-v0)

OfflineStub exports elemental **`perc` StemId + WAV only when `perc.hits.length > 0`** — empty perc role ⇒ no silent `perc.wav` (manifest notes the omit). Mixer/remix treat perc as elemental when present. Drums bus remains a summed bus (manifest notes). Gate: `src/test/stem-perc-a3.test.ts`. Soft-pass forbidden.

## Section energy (A7)

Automated: OfflineStub drop-section RMS ≥ intro × 1.25 (`section-energy.test.ts`). Soft-pass forbidden.

## Preview path

OfflineStubBackend.render → stem blobs → PreviewPlayer. Remix path re-sums elementals + glue. No live Tone synth graph.

## User docs

Prefer browser sketch / local GPU later in FIRST_RUN / GLOSSARY / HelpPanel / NOOB_GUIDE. Eng names (OfflineStub, ACE, sidecar) OK here and in Power Mode.
