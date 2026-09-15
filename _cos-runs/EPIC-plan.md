# EPIC-listen-slap — plan (DnB-Paid, brain)

Written after reading code directly (not trusting doc claims). FCC not reachable
from this session (`ListAgents` = none live); COS-STATUS-PC.txt FCC entry may be
stale or an external process this harness can't see. No git repo here either, so
no merge safety net — if FCC is genuinely live on the same files, coordinate via
this file's checkboxes, don't both touch `PreviewPlayer.ts` at once.

## Verified current state (read code + docs directly, 2026-09-14)

1. **Sound slap / OfflineStub** — mature (940-line synth). Pattern-family
   selection, 808/sub-bass, energy-curve gains, kick→bass sidechain duck, mix-bus
   glue+soft-ceiling all exist and are exercised by tests (`pattern-family-vary`,
   `onset-grid`, `section-energy`). **Real gap found**: none of that duck/glue
   applies to the *live* Tone.Channel mixer path — see below. This is the
   concrete, unfixed instance of the "must slap not toy" bar.
2. **Listen-first shell** — `TransportBar.tsx` + `Waveform.tsx` both read
   `previewPlayer.getProgress()`/`getDurationSec()` via rAF, both feed
   `resolvePlaybackDuration()` (`src/ui/lib/barPosition.ts`) — one source of
   truth. `SectionTimeline.tsx:197-208` already seeks on section click. Elapsed/
   total is honest audio time. **No action needed.**
3. **Expand/Vary + seed** — confirmed correct: Expand sets `editedSections` so
   Generate keeps seed; Vary rolls a new seed + chaos nudge
   (`structure-expand.test.ts`, `vary-chaos-nudge.test.ts`). **No action needed.**
4. **UI polish** — hand-written `app.css` (no Tailwind) already has extensive
   glassmorphism; `docs/ux-must-fixes-final-ui-sprint.md` and
   `ux-impress-sprint-p0.md` both closed PASS today with itemized, grep-checkable
   verdicts (not vague self-praise). **No action needed** — re-litigating signed
   UI work would violate "don't invent/nibble" discipline.
5. **HelpTips** — `HelpTip.tsx` + `helpCopy.ts`, 118 usages across 23 files,
   `helptip.test.ts` hard-enforces `What:/When:/What happens:` structure + no
   jargon. **No action needed.**

## The real fix — live mixer parity ("must slap")

`src/core/audio/PreviewPlayer.ts` `loadLiveFromStems()` (~line 411-482) wires
every elemental stem as `Tone.Player → new Tone.Channel(...).toDestination()`
**independently** — no shared bus, no compressor, no sidechain. The moment a
user touches mute/solo/gain (the *documented, required* live-tweak path per
CLAUDE.md: "Live mute/solo/gain = Tone.Channel mid-play"), playback silently
drops the kick→bass duck and mix-bus glue that `OfflineStubBackend.ts`
(`sidechainDuckBass` L388, `applyMixBusGlue` L419) and the export/remix path
(`renderRemixedWavBlob`, `loadMixFromStems` L564) both have. Net effect: the
flat/export mix slaps, but the moment you touch a fader — the exact "tweak"
step of the noob journey — it goes thin and loose. This is the highest-value,
most concretely wrong thing found this pass.

**Fix (GRUNT — mechanical once designed):**

1. Add a shared master bus in the live graph: `Tone.Gain` → `Tone.Compressor`
   (peak-glue character mirroring `applyMixBusGlue`: thresh ~-20dB, ratio ~4,
   fast attack/slower release) → `Tone.Limiter` (ceiling ~-0.3dB) → destination.
   Each lane's `Tone.Channel` connects to this bus instead of `.toDestination()`.
2. Kick→bass duck: insert one extra `Tone.Gain` node ("duckGain", linear
   amplitude) in the bass lane's chain *before* its `Tone.Channel` (so it never
   fights user mute/solo/gain, which stays on the Channel). Tap the kick lane's
   output post-fader with a `Tone.Analyser({type:'waveform'})`. Drive
   `duckGain.gain.value` from a rAF loop while `state === 'playing'`, using an
   attack/release envelope follower — same shape as
   `OfflineStubBackend.sidechainDuckBass` (attack ~3-8ms, release ~40-80ms,
   duck ~2.4-4dB) but read live each frame instead of precomputed per-sample.
   Extract the envelope-follower math as a small **pure, exported function**
   (e.g. `duckEnvelopeStep(levelAbs, prevEnv, atkCoef, relCoef): number`) shared
   conceptually with the offline version so both are provably the same curve —
   this is the only part practically unit-testable, since jsdom/vitest has no
   real Web Audio and existing tests already only spy over `loadLiveFromStems`/
   `applyLiveMixer` rather than exercise real `Tone.Channel` objects.
3. `teardownLiveGraph()` must dispose the new bus/compressor/limiter/duckGain/
   analyser nodes and cancel the rAF loop (no leak on regenerate/dispose).
4. Rationale for rAF-driven live analysis over precomputed schedule: playback
   doesn't use `Tone.Transport` today (`startPlaybackAt` uses `Tone.now()` +
   raw `player.start(when, offset)`), so there's no transport clock to schedule
   duck automation against; scheduling from `structure.drums` kick hit times
   would need new offset bookkeeping that breaks on every seek/loop. Live
   analysis self-corrects on seek for free.

**Tests (must add, must be real gates not soft):**
- Unit test the extracted envelope-follower function directly (deterministic,
  no Tone/AudioContext needed): attack faster than release, duck depth
  proportional to kick level, no duck at kick silence, monotonic decay.
- Keep `live-mixer-preview.test.ts` and `live-tweak-preview.test.ts` green
  unchanged (they test the native fallback + store wiring, unaffected by this).
- Do not claim live audio "sounds right" without a listen — same honesty rule
  as the existing audio critic doc's P1.6. Note this limitation in the PR
  summary rather than inventing a passing perceptual test.

## Critic pass (item 5)

After the fix lands and tests are green, run the `critic` subagent for a fresh
noob-journey pass (open→style→generate→play→tweak→rehear→export) specifically
re-checking live-tweak punch parity claim, since that's new. Fix only concrete,
cited table-stakes gaps it finds — do not expand scope speculatively.

## Non-goals this pass (explicit)

- Not re-doing UI/CSS/HelpTip work already signed off today — verified by
  reading the actual code and docs, not by trusting old claims blindly, but
  they hold up.
- Not touching BPM lock / true-peak naming / ZIP CRC / other P1/P2 items from
  `docs/critic-audio-must-fixes-cycle-4.md` — real but out of this epic's scope
  (not part of the 5 brief bullets); noting them here so they aren't confused
  with this pass's work if re-audited later.

## Status

- [x] Live master bus (Compressor+Limiter) wired, replacing `.toDestination()`
      per-lane — GRUNT (`PreviewPlayer.ts` `loadLiveFromStems()`: `liveGlueComp`
      → `liveLimiter` → destination, each lane's `Channel.connect(masterBus)`)
- [x] Kick→bass duckGain node + rAF envelope follower wired — GRUNT
      (`PreviewPlayer.ts` duck loop reads `liveKickAnalyser`, drives
      per-lane `duckGain` ahead of each `Channel`)
- [x] Envelope-follower pure function extracted + unit tested — GRUNT
      (`src/core/audio/ducking.ts`: `duckEnvelopeStep`, `duckGainFromEnvelope`,
      `computeDuckShapeParams`; covered by `src/test/live-duck-envelope.test.ts`)
- [x] `teardownLiveGraph` disposes new nodes / cancels rAF — GRUNT
      (cancels `duckRafId`, disposes lane `duckGain`/`channel`/`player`,
      `liveKickAnalyser`, `liveGlueComp`, `liveLimiter`, `liveMasterBus`)
- [x] `npm.cmd test -- --run` green — 38/38 files, 226 passed / 2 skipped, 0 failed
- [ ] `npx tsc --noEmit` — NOT VERIFIED: this sandbox denies every invocation
      of `tsc` (npx, npx.cmd, direct `.bin` binary) at the permission layer,
      no approval surface available. Needs an interactive session to close.
- [ ] Critic subagent pass on noob journey + live-tweak parity (out of scope
      for BRIEF-paid-epic-close-v2 — see that brief's "Out" list)
