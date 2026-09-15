# BRIEF-paid-verify-p1 — hard brain + verify ONLY (no src/)

WRITER=DnB-Paid. Brain/verify only. Do NOT edit `src/` — FCC owns HelpTips (`helpCopy.ts` / `helptip.test.ts`) right now on BRIEF-fcc-helptips-p0a-dead-keys.

## Context
- Just finished `_cos-runs/PAID-P1-NEXT.md` (EXIT=0) with FCC GRUNT specs for: HelpTips leftovers, ZIP CRC test, seed→audio repro.
- Prior paid session could NOT run `npx tsc --noEmit` / `npm.cmd test -- --run` (approval surface). Soft-pass forbidden — you must run them now and record real numbers.

## Do
1. Run `npx tsc --noEmit` and `npm.cmd test -- --run`. Record exact exit codes + failing test names into `_cos-runs/PAID-VERIFY-P1.md`. No invented counts.
2. Re-read `_cos-runs/PAID-P1-NEXT.md` against the tree. Confirm or correct §1–§3 file ownership vs current FCC LIVE (HelpTips P0-A).
3. Write/refresh the **next FCC queue** in `_cos-runs/PAID-VERIFY-P1.md`: ordered copy-paste briefs after HelpTips P0-A EXIT — (a) stems copy if still open, (b) zip CRC test, (c) seed audio repro — each with hard-disjoint files.
4. Optional Critic noob-journey checklist from PAID-P1-NEXT §7 — docs only in the same file.
5. Stay OFF: `helpCopy.ts`, `helptip.test.ts`, `PreviewPlayer.ts`, `OfflineStubBackend.ts`, `SectionTimeline.tsx` while FCC is mid-flight.

## Acceptance
- `PAID-VERIFY-P1.md` has real verify snapshot + ordered next FCC briefs
- No `src/` edits
- Soft-pass forbidden

Est ~15 turns.
