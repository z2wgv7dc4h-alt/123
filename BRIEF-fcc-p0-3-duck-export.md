# FCC P0-3 relaunch (prior EXIT=1 max_turns) — TIGHT

Scope fat last run (OfflineStub+PreviewPlayer+docs+full suite thrash). Stay mechanical.

## Do ONLY (order)
1. OfflineStubBackend: elemental `bass` stem stays DRY (no baked sidechain). Duck only on mix/drums bus path.
2. PreviewPlayer live rAF duck stays sole live duck (reuse ducking.ts). Do not redesign live bus.
3. renderRemixedWavBlob: apply same duckGainFromEnvelope/duckEnvelopeStep so mix_as_heard matches live on kick mute.
4. ONE new test that fails before / passes after (elemental bass unducked vs mix ducked).
5. npm.cmd test -- --run + npx.cmd tsc --noEmit. Write _cos-runs/FCC-P0-3-RESULT.md last.

## Files
OfflineStubBackend.ts, PreviewPlayer.ts (remix/duck only), ducking.ts if needed, one test file, FCC-P0-3-RESULT.md.
## Out
StructureEngine, Expand tests, ACE, CSS, soft-pass, drive-by refactors.
