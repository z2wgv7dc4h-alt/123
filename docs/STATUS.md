# DnB Studio — Living Status

Last regenerated: 2026-09-15, by actually reading and running the code (tests,
`tsc`, and live GPU renders against the real ACE stack on the RTX 5080) —
not from memory of intent. Update this file in the same change as any fix
that alters what it claims; stale docs are worse than no docs.

## History in one paragraph

Grok shipped a clean Phase 0 (`OfflineStub`-only, honest, small) around
2026-09-06. On 2026-09-14 an unsupervised multi-agent pipeline (Grok as
orchestrator, an Nvidia Nemotron model as the sole file-writer "FCC", Claude
Sonnet as a secondary reviewer) ran for ~7 hours producing ~40 tickets and
heavy churn, with no git history under any of it. On 2026-09-15 the project
got version control for the first time, a cleanup pass, a UI restructure, and
the two real bugs below got found and fixed by actually running the GPU
stack rather than just reading code. The repo root and `docs/` were also
cleaned of ~60 one-off ticket/ops files from that burst — none of it was
documentation, all of it is still in git history if ever needed.

## Proven working (with evidence)

- **ACE-Step 1.5 / Studio GPU is genuinely live** on the RTX 5080
  (`acestep-v15-base`, PyTorch cu128, `cuda:0`). Confirmed via the bridge's
  own `/probe` (`hasGpu: true`) and, more importantly, via two full
  end-to-end renders whose raw model logs were inspected directly (not
  inferred from the UI).
- **Section structure now reaches ACE.** Before 2026-09-15, ACE received
  `lyrics: "[Instrumental]"` unconditionally (confirmed in the raw model
  log) — zero temporal signal, so the drop/build/breakdown never actually
  corresponded to the arrangement map, just one flat pass shaped only by the
  global caption. Fixed: `AceStepBackend.ts` now sends
  `structureRef.sections` (name/startBar/lengthBars); `ace_bridge_server.py`
  maps them to ACE's documented per-section lyric tags (`[Intro]`/`[Build]`/
  `[Drop]`/`[Breakdown]`/`[Outro]`, structural tags only, no words, no
  vocals). Verified in the raw ACE log: the Lyric field now shows the real
  section sequence, and renders complete cleanly.
- **Generate no longer silently falls back to Sketch.** `generate()` used
  to re-probe ACE itself, then (when picking Studio) call
  `BackendRegistry.selectBest()`, which probes a *second* time internally.
  Any hiccup on that second probe returned `OfflineStub` with no error and
  no toast, even with the Studio/GPU badge showing live seconds earlier —
  reproduced twice in a row on real hardware. Fixed by reusing the probe
  result `generate()` already just took, instead of probing a third time.
- **Sketch is no longer drums+bass only.** `OfflineStubBackend.ts` has a
  working `applyGuitarLayers()` (rhythm guitar in drop/build, a sparse lead
  line in drop/outro) and an extra-drums path — pure CPU synthesis, no GPU
  involved — but the UI hard-disabled all four "Add heat" layer toggles
  behind `!aceHasGpu`. Fixed: guitar/solo/extra-drums now work in Sketch;
  only vocal-ish (which has no CPU synthesis path — ACE-caption-only) stays
  Studio-gated.
- **OfflineStub's composition engine is not obviously broken.** Read in
  full: real DnB-idiom pattern grammar (amen / two-step / syncopated
  families), correct half-time snare-on-3 logic, section-aware energy
  curves, section-boundary fills. If the output still sounds wrong, the
  likely levers are timbre/synthesis quality and caption/style engineering,
  not the note-selection logic itself.
- **Listen-first UI**: Generate/Play/Vary/Export, the waveform, the
  arrangement map, and mute controls now live in one `position: sticky`
  panel that stays pinned while the page scrolls; style/shape/layer tweaks
  moved below as secondary "tweak, then Generate again" content. Verified
  in-browser at 1440×900 and 375×812 (mobile) — stays pinned, no overflow.
- **Visual direction**: "Club/Rave" (magenta/cyan/acid-green neon on
  near-black, Space Grotesk/Space Mono) applied via the existing CSS
  custom-property system (`:root` in `app.css`), plus a bulk fix of ~200
  `rgba()` references that were still hardcoding the old palette's literal
  RGB values, and matching updates to the waveform's canvas-drawn colors
  (those are JS `fillStyle` strings, not CSS, so the variable remap didn't
  reach them automatically).
- **Version control exists.** The project had none before 2026-09-15. Now
  git-initialized, pushed to `github.com/z2wgv7dc4h-alt/123`. Going forward,
  commits and doc updates happen contemporaneously with code changes, not
  batched at session end (standing instruction from the user).

## Open questions — not yet resolved

- **Does the composition/style actually match the target reference sound**
  (e.g. Pendulum-style big-room DnB)? Three rounds of real listening
  feedback so far, all from the user on 2026-09-15:
  1. "sounds like nonsense, not composed at all" → traced to the bass
     leaping up to 19 semitones between consecutive notes with no voice
     leading → fixed (`nearestOctaveTo()`, below).
  2. Still "sounds like a video game" → traced to `writeGuitarChord` /
     the solo root / `writeRockMid` all being hardcoded to fixed pitches
     (196 Hz / MIDI 57 / 520 Hz) regardless of `structure.keyRoot` — could
     clash outright with the bass in any other key — plus raw
     tanh-distorted sine with no filtering (reads as a buzzy chiptune
     square wave). Fixed: all three now derive pitch from the real key,
     the guitar layer voices an actual power chord instead of one bare
     tone, and a lowpass shapes the distortion toward an amp tone.
  3. "theres a machinegun in the background... get a source from git" →
     hats were firing 32nd notes through the *entire* drop/build section
     for syncopated/trap families (~43ms apart at 174bpm, sustained).
     Researched real production references instead of guessing again:
     16th notes are the actual DnB hat baseline; 32nds are an
     occasional roll/accent technique, never a sustained grid. Fixed
     the density, and separately rebuilt kick/snare/hat synthesis after
     reading a real sample-free Web Audio drum synthesis reference
     ([dev.to/sendotltd, MIT-licensed](https://dev.to/sendotltd/sample-free-drum-synthesis-in-web-audio-building-kick-snare-and-hi-hat-from-oscillators-in-60-2c0k)):
     added a proper resonant bandpass biquad (RBJ Audio EQ Cookbook
     formula) for snare crack and hat metallic ring — the old "filter"
     was a bare 1-pole differencer that just reads as fizzy hiss with
     no resonance — plus a steeper kick pitch-sweep for more attack.
  Sent a fourth comparison render — **not yet confirmed**, same rule as
  every round before it: don't mark this resolved until the user says so.
- **Bass voice leading** (fixed 2026-09-15,
  `src/core/structure/StructureEngine.ts` `nearestOctaveTo()` +
  `src/test/bass-voice-leading.test.ts`): every bass note now re-octaves
  toward the previous note instead of landing wherever `root + interval`
  happens to fall. Deliberately resets at section boundaries (each section
  plans from an independent RNG stream for the Expand/Repeat
  byte-identical guarantee), so one register jump can still land exactly
  at a section transition — that's intentional, not a bug.
- **Guitar/lead/rock-mid key-following** (fixed 2026-09-15,
  `OfflineStubBackend.ts` + `midiForRoot` exported from
  `StructureEngine.ts` + `src/test/guitar-layer-key.test.ts`): see above.
  Still true and un-audited: the solo still cycles through only 3 fixed
  scale degrees in a repeating 4-bar pattern regardless of section
  harmony — mechanical, not wildly leaping, but worth a look if the lead
  specifically still sounds off after this round.
- **`PreviewPlayer.ts` duck-shape drift risk**: live-preview ducking and
  offline-render ducking both now call the shared `computeDuckShapeParams`
  (fixed 2026-09-15), but they're still two independent implementations
  (one operates on Tone.js nodes in real time, one on Float32Arrays
  offline) — they can't literally be unified, so watch for drift if either
  is touched without touching the other.

## Not shipped

- LEGO stem extract/repaint / LoRA train — ACE stem lanes share the mix
  until this lands; the UI/docs say so and that must stay true.
- Vocal-ish layer for Sketch — no CPU synthesis path exists; correctly
  stays Studio-only.
- Tauri desktop smoke test — scaffold is in-tree (`src-tauri/`), browser
  Sketch is still primary. ACCEPTANCE stays unchecked on this until an
  actual desktop smoke run happens.
- Subgenre "family" shape chips (neuro/liquid/jump-up/techstep) beyond the
  current song-shape presets (Classic/Long intro/Breakdown/Double drop/
  Half-time drop/Dubstep feel/Trap bounce) — mentioned in old `_cos-runs`
  planning notes (now removed from the tree, still in git history) but
  never built.

## Repo hygiene

As of 2026-09-15: removed ~60 files that were one-off task tickets and
multi-agent ops scratch from the 2026-09-14 burst (root-level `BRIEF-*.md`,
`_cos-runs/*`, `docs/ux-must-fixes-cycle-*.md`, dead orchestration scripts
in `scripts/`) — none of it was living documentation, and all of it is
still recoverable from git history if ever needed. `docs/` now holds only
the files README.md actually links to as canonical.
