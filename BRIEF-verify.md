# VERIFY only — no product edits

## Do
1. `npm.cmd test -- --run`
2. `npx.cmd tsc --noEmit`
3. Write `_cos-runs/VERIFY-RESULT.md` with EXIT codes + failing test names (if any). Soft-pass forbidden.

## Don't
- No src/ edits, no refactors, no plan rewrites.
