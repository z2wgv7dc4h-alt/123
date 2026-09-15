# DnB Studio — Architecture (Phase 0/1)

**Date:** 2026-09-06, updated 2026-09-15 (PT / Australia·Perth)
**Product:** Local-first hybrid studio for original energetic rock-DnB / dancefloor DnB (~174 BPM).
**Phase 0 ship:** Vite + React + TS browser app with HardGridStructureEngine + OfflineStubBackend (CPU). ACE-Step GPU sidecar is fail-soft / gated, and as of 2026-09-15 is proven live on the RTX 5080 — see docs/STATUS.md.

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

- **Tone.js as synth engine — KILLED (preview of WAV only).** Tone.js is
  still used, but scoped to live playback (`Tone.Channel` mute/solo/gain
  while a rendered WAV plays) — never to generate the audio that gets
  bounced to WAV. That's 100% hand-written Float32Array math
  (`OfflineStubBackend.ts`). Rationale (reconstructed 2026-09-15, not
  previously documented — asked about directly by the owner and answered
  from reading the code, not from a recorded decision): (1) deterministic
  reproducibility — same seed produces a byte-identical WAV, provable;
  a real-time audio-graph engine makes that far harder to guarantee;
  (2) **this is what makes the whole project's Node-based render/test
  workflow possible** — `scripts/render-styles.mjs`,
  `scripts/render-compare.mjs`, and most of `src/test/*` run the actual
  synthesis in plain Node via `vite-node` with zero `AudioContext`,
  because it's just array math; if Tone.js generated the audio itself,
  none of that would work outside a real browser tab; (3) exact bit-depth/
  WAV-encoding control is simpler owning every sample directly. Owner has
  said they're open to revisiting this if it would genuinely help sound
  quality, but the recommendation (given as of 2026-09-15) is to keep it —
  it isn't what's capping sound quality, and abandoning it costs the
  testability every fix this project has relied on depends on.
- Artist-clone product / catalog rips / stem RE — FORBIDDEN; style text may keep vibe words (scrubArtistNames no-op)
- Train on third-party catalogs — FORBIDDEN (ethical/copyright line — unaffected by the licensing note below)

**Tool/dependency licensing relaxed 2026-09-15** (owner decision — personal,
non-commercial project): GPL/AGPL/NC-licensed tools and libraries are fine to
integrate now (sample packs, synth engines, DSP code), as long as nothing is
sold or redistributed. The prior list (ACE-Step-DAW/Strudel AGPL, MusicGen NC,
Matchering/Pedalboard GPL "forbidden in binary") was a commercial-distribution
constraint that no longer applies — see docs/STATUS.md "Not leveraging yet"
for what this actually unblocks.

## BPM lock

- Product target 174 BPM; UI band 170–176.
- Acceptance |measured − 174| ≤ 2.0 provisional (structure lock; no audio BPM meter yet).
- OfflineStub locks plan BPM to structure map.

## Backend registry

1. offline-stub — CPU Float32 sketch → real WAV blobs (legoStems false). As of
   2026-09-15, also synthesizes guitar/solo/extra-drums texture layers
   (pure CPU, no GPU) — only vocal-ish has no CPU path and stays Studio-only.
2. ace-step-1.5 — **live** on the RTX 5080 (`acestep-v15-base`, cu128) when
   `scripts/windows/start-ace-stack.ps1` is running; fail-soft to offline-stub
   otherwise. Proven end-to-end 2026-09-15 (see docs/STATUS.md).

`BackendRegistry.selectBest()` re-probes ACE internally and keeps OfflineStub
until that probe reports `hasGpu`. `useStudioStore.generate()` does **not**
call `selectBest()` — it re-probes once itself at the top of `generate()` and
reuses that result directly. Calling `selectBest()` from inside `generate()`
was a real bug (fixed 2026-09-15): it re-probed a *second* time and any
hiccup on that second probe silently returned OfflineStub with no error or
toast, even right after the first probe had just succeeded. If you touch
backend selection, probe exactly once per Generate.

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
