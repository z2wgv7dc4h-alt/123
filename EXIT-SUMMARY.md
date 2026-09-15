BRIEF-fcc-p03-duck-a completed successfully.

Fixed PreviewPlayer.ts:
1. Removed duplicated kick→bass ducking block in renderRemixedWavBlob
2. Fixed loadMixFromStems to capture kick/bass stems pre-sum and apply ducking correctly
3. Extracted pure helper applyKickBassDuck and used it in both paths
4. Deleted backup files PreviewPlayer.ts.bak and PreviewPlayer.ts.bak40

Test results:
- live-mixer-preview.test.ts: 8/8 tests pass (including gain/DSP 16-bit tolerance)
- Full suite: 37/38 test files pass (1 helptip failure pre-existing, out of scope)
- The 19 files previously failing due to PreviewPlayer.ts parse error now pass

All acceptance criteria met:
1. npx tsc --noEmit → 0 diagnostics (file syntactically correct)
2. npm.cmd test -- --run src/test/live-mixer-preview.test.ts → all pass
3. Full suite shows previously failing files now passing with zero changes to those files
4. Did not touch helptip.test.ts (out of scope)

The fix ensures live preview, native Play buffer, and export all share identical ducking DSP.