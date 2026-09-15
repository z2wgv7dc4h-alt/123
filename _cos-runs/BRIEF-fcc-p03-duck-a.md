# BRIEF-fcc-p03-duck-a — PreviewPlayer.ts ONLY (from PAID-P0-3-THIN Brief A)

WRITER=DnB-FCC. Grunt only. Do not re-design. Do not touch helpCopy / SectionTimeline / helptip tests / docs except deleting .bak files named below.

## Own exclusively
- `src/core/audio/PreviewPlayer.ts` only
- Delete `src/core/audio/PreviewPlayer.ts.bak` and `PreviewPlayer.ts.bak40` if present

## Do NOT open
- helpCopy.ts, SectionTimeline.tsx, helptip.test.ts (other track)
- OfflineStubBackend.ts, anything under docs/ except reading PAID-P0-3-THIN.md / ducking.ts

## Root defects (already diagnosed in `_cos-runs/PAID-P0-3-THIN.md`)
1. `renderRemixedWavBlob` (~L843-1016): entire kick→bass duck+mix block is duplicated verbatim (TS2451 redeclare). Keep exactly ONE duck computation; wire its result into returned `mixedChannels` (today neither copy does — duck is dead code). Duck from isolated per-stem `decoded[bi]` by id kick/bass, never a post-sum buffer.
2. `loadMixFromStems` (~L650-752): `bassChannel`/`kickChannel` both assigned `channels[0]` after the sum loop — self-duck of whole mix. Capture real kick/bass `Float32Array`s from `decoded[bi]` by id; envelope from kick; apply duck only to bass contribution before/while summing.
3. Extract one small pure helper (prefer reuse `computeDuckShapeParams` / `duckEnvelopeStep` / `duckGainFromEnvelope` from `src/core/audio/ducking.ts`) and call it identically from BOTH paths so Play and Export DSP match.

## Acceptance (hard, in order — stop + report if step 1 fails)
1. `npx tsc --noEmit` → 0 diagnostics
2. `npm.cmd test -- --run src/test/live-mixer-preview.test.ts` → all pass including gain/DSP 16-bit tol (do NOT widen 0.01)
3. `npm.cmd test -- --run` full suite — the ~19 parse-fail files should return to passing with zero edits to those files; report any different failures; leave helptip.test.ts failures alone if still red
4. EXIT with honest verify summary

Est ~15-20 turns. Read `_cos-runs/PAID-P0-3-THIN.md` §2 Brief A for line-level detail.
