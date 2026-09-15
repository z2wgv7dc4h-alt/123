# FCC GRUNT — leftover snare-on-2 prompt lie (quick)

Soft-pass forbidden. Engine already places half-time/dubstep/trap-bounce snare on beat 3 (StructureEngine ~200–205). songShapes blurbs already say snare on 3.

## Still wrong
`src/ui/hooks/useStudioStore.ts` ~1034 injects: `half-time snare on 2, heavy dubstep-feel drop at 174 bpm` — change to **snare on 3**. Grep `src/` for any other `snare on 2` and fix.

## Do
1. Fix that string (+ any other snare-on-2 copy under src/).
2. Confirm `src/test/snare-placement.test.ts` still green for drop snare-on-3; strengthen only if it would miss this copy path.
3. npm.cmd test -- --run src/test/snare-placement.test.ts then full npm.cmd test -- --run (+ tsc if approval works). Write `_cos-runs/FCC-SNARE-ON-3-RESULT.md`.

## Files ONLY
useStudioStore.ts (prompt string); optional snare-placement.test.ts / songShapes.ts if copy elsewhere.
Out: ACE stack, OfflineStub, PreviewPlayer, helpCopy.
