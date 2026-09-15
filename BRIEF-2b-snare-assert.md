# BRIEF-2b — Harden snare-on-3 proof (paid Sonnet)

## Goal
BRIEF-2 claimed half-time snare-on-3. Custom test only logs hits. Make the proof hard.

## Do
1. In `src/test/custom/snare-placement.test.ts` (or move into main suite): assert half-time **drop** snares land on beat index **2** (0-based = beat 3). Fail if on 1.
2. Keep kick/snare pattern honest for half-time drop; no BRIEF-1 seek/keepSeed regression.
3. Do **not** edit player-duration / Vary diversity files that BRIEF-3 (FCC) may be touching (`playback-duration`, vary-chaos, pattern-family-vary, SectionTimeline listen-expand store seed paths) unless required for compile.
4. Done: `npm.cmd test -- --run` and `npx tsc --noEmit` green. Soft-pass forbidden.

## Context
Full suite was 217 pass after BRIEF-2; snare test logged beats [2,2,2,2] but did not assert.
