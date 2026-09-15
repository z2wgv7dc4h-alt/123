# EPIC-listen-slap — DONE (DnB-Paid, epic-close v2)

## Landed
- Live master bus parity: `PreviewPlayer.loadLiveFromStems()` now routes every
  lane's `Tone.Channel` into a shared `Tone.Gain` → `Tone.Compressor`
  (`liveGlueComp`) → `Tone.Limiter(-0.3dB)` (`liveLimiter`) → destination,
  replacing the old per-lane `.toDestination()`.
- Kick→bass live sidechain duck: a `duckGain` node sits ahead of the bass
  lane's `Channel`; a rAF loop reads `liveKickAnalyser` and steps
  `duckEnvelopeStep()` each frame to drive it, mirroring
  `OfflineStubBackend.sidechainDuckBass`'s attack/release shape.
- Envelope math extracted to pure, unit-tested functions in
  `src/core/audio/ducking.ts` (`duckEnvelopeStep`, `duckGainFromEnvelope`,
  `computeDuckShapeParams`), covered by `src/test/live-duck-envelope.test.ts`.
- `teardownLiveGraph()` disposes `duckGain`/`channel`/`player` per lane plus
  `liveKickAnalyser`, `liveGlueComp`, `liveLimiter`, `liveMasterBus`, and
  cancels the duck rAF loop — no leak on regenerate/dispose.
- `_cos-runs/EPIC-plan.md` GRUNT checkboxes marked done, verified against
  code (not memory) at each line cited.

## Listen caveat
None of the above was confirmed by ear in this pass — no audio playback in
this environment. The live-graph wiring and the envelope-follower math are
verified by code reading and unit test; whether the live-tweak path actually
*sounds* glued/punchy versus the offline render is unverified. Flagged per
CLAUDE.md honesty rule rather than claimed.

## Verify
- `npm.cmd test -- --run`: **green** — 38/38 files, 226 passed / 2 skipped,
  0 failed.
- `npx tsc --noEmit`: **not verified this session** — this sandbox denies
  every invocation of `tsc` (direct, via npx, via the local `.bin` binary)
  at the permission layer with no approval surface available, before the
  compiler itself runs. Not a code failure; someone with an interactive
  session needs to run it to close this out.

## Non-goals left (explicit, per brief's "Out" list)
- Critic subagent deep pass on the noob journey / live-tweak parity claim.
- UI/CSS, LayersChips changes.
- Audio P1/P2 backlog items (BPM lock, true-peak naming, ZIP CRC, etc.).
- FCC coordination.
- Any `PreviewPlayer.ts` rewrite beyond what tests already forced.
