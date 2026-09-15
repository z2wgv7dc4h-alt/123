# Verify Result

## Commands run

- Test command run: `npm.cmd test -- --run` (as specified in BRIEF-verify.md)
- Typecheck command run: `npm.cmd run typecheck` (equivalent to `npx.cmd tsc --noEmit` —
  substituted because the sandbox permission system denied the literal
  `npx.cmd tsc --noEmit` invocation on every attempt, while `npm.cmd run typecheck`
  was permitted. Per package.json, the `typecheck` script is defined as exactly
  `tsc --noEmit`, so this runs the identical underlying compiler invocation.)

## EXIT codes

- `npm.cmd test -- --run` EXIT CODE: 0
- `npm.cmd run typecheck` (== `tsc --noEmit`) EXIT CODE: 0

Note: the sandbox permission system did not allow appending `; echo $?` to
capture the raw shell exit code directly. The EXIT CODE of 0 for both commands
is inferred from: (1) vitest's own summary line reporting all test files and
tests passed with zero failures, and (2) npm printing no `npm ERR!` failure
banner and tsc emitting zero diagnostic output (tsc prints nothing to stdout/
stderr on a clean --noEmit run and only emits a nonzero exit on error).

## Test results (`npm.cmd test -- --run`)

```
 Test Files  38 passed (38)
      Tests  226 passed | 2 skipped (228)
   Start at  08:16:31
   Duration  14.04s (transform 2.49s, setup 0ms, collect 14.93s, tests 68.43s, environment 8ms, prepare 5.43s)
```

No failing tests. 0 failures. 2 tests skipped (verbatim from output, in
`src/test/license-clean-fixtures.test.ts`, reported as "5 tests | 2 skipped").

Full list of test files (all passed), verbatim from output:

```
src/test/ace-caption-vary.test.ts (5 tests)
src/test/ace-backend-render.test.ts (2 tests)
src/test/helptip.test.ts (14 tests)
src/test/polish.test.ts (9 tests)
src/test/honesty.test.ts (14 tests)
src/test/license-clean-fixtures.test.ts (5 tests | 2 skipped)
src/test/live-duck-envelope.test.ts (8 tests)
src/test/pattern-family-vary.test.ts (4 tests)
src/test/invent-46-51.test.ts (17 tests)
src/test/invent-52-63.test.ts (11 tests)
src/test/structure-expand.test.ts (10 tests)
src/test/structure.test.ts (1 test)
src/test/invent-82-87.test.ts (8 tests)
src/test/render-sample.test.ts (1 test)
src/test/listen-expand.test.ts (4 tests)
src/test/onset-grid.test.ts (1 test)
src/test/waveform-seek.test.ts (8 tests)
src/test/structure-shapes.test.ts (7 tests)
src/test/vary-chaos-nudge.test.ts (5 tests)
src/test/vibe-mirror.test.ts (6 tests)
src/test/style-reference.test.ts (16 tests)
src/test/custom/snare-placement.test.ts (1 test)
src/test/invent-64-69.test.ts (4 tests)
src/test/playback-duration.test.ts (5 tests)
src/test/e2e-invariants.test.ts (7 tests)
src/test/product-tier.test.ts (3 tests)
src/test/invent-76-81.test.ts (6 tests)
src/test/retail-labels.test.ts (2 tests)
src/test/zip.test.ts (1 test)
src/test/simple-process-order.test.ts (7 tests)
src/test/mixer-dirty.test.ts (3 tests)
src/test/section-energy.test.ts (2 tests)
src/test/params-dirty.test.ts (3 tests)
src/test/stem-perc-a3.test.ts (4 tests)
src/test/export-bit-depth.test.ts (5 tests)
src/test/live-tweak-preview.test.ts (5 tests)
src/test/live-mixer-preview.test.ts (8 tests)
src/test/mix-as-heard.test.ts (6 tests)
```

(38 files total, matching "Test Files 38 passed (38)".)

## TypeScript results (`npm.cmd run typecheck` == `tsc --noEmit`)

Raw output:

```
> dnb-studio@0.1.0 typecheck
> tsc --noEmit
```

No diagnostics/errors printed. 0 TypeScript errors.

## Summary

Both commands passed cleanly:
- Test suite: EXIT 0, 226 passed / 2 skipped / 0 failed across 38 files.
- TypeScript: EXIT 0, no compiler errors.

No src/ files were read for editing purposes and none were modified. This
report was produced strictly from the verbatim command output captured above.
