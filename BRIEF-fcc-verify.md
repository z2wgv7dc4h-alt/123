# FCC GRUNT — verify only (no product edits)

## Do
1. `npm.cmd test -- --run`
2. `npx.cmd tsc --noEmit`
3. Append result lines to `_cos-runs/VERIFY-RESULT.md` with timestamp + EXIT codes + fail names.
4. No src/ edits.

## Done
VERIFY-RESULT.md written; EXIT reflected in log.
