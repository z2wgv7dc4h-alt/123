# BRIEF-paid-brain-p1-next — hard brain ONLY (docs, no src/)

WRITER=DnB-Paid. Brain only. Do NOT edit `src/` (FCC owns PreviewPlayer.ts this turn; HelpTips mid-flight elsewhere).

## Context
- EPIC-listen-slap mostly closed; suite currently RED because PreviewPlayer.ts has duplicated duck block (FCC Brief A in flight: BRIEF-fcc-p03-duck-a.md).
- `_cos-runs/PAID-P0-3-THIN.md` §4 already ranked next P1s after duck lands.
- `_cos-runs/PAID-NEXT-BRAIN.md` still has HelpTips GRUNT leftovers (dead keys / Expand tips / stems copy) — FCC may have partially landed expandSection.

## Do
1. Re-read tree honestly (helpCopy + SectionTimeline + zip export path + seed tests) — no soft-pass.
2. Write `_cos-runs/PAID-P1-NEXT.md` with:
   - Exact FCC GRUNT brief for HelpTips leftovers (files + acceptance) OR mark DONE if already green.
   - Exact FCC GRUNT brief for **P1.1 Export ZIP CRC integrity** (test + writer fix) — cheapest correctness gap.
   - Exact FCC GRUNT brief for **P1.3 seed→audio reproducibility** (not just StructureMap).
   - Note on P1.2 true-peak honesty (rename vs implement) — design decision only.
   - Hard disjoint file ownership so next FCC+paid can run parallel without colliding with PreviewPlayer.
3. Optional: one Critic-style noob-journey checklist for after Brief A greens — doc only in PAID-P1-NEXT.md.
4. Run `npx tsc --noEmit` and `npm.cmd test -- --run` only to snapshot truth into the doc (expect RED until FCC A lands). Do not "fix" by editing src.

## Acceptance
- `PAID-P1-NEXT.md` written with copy-paste-ready FCC briefs
- No src/ edits
- Honest verify snapshot recorded

Est ~15-20 turns.
