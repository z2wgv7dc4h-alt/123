# BRIEF-paid-brain-p03-thin — Paid BRAIN (prefer docs over code)

Context: FCC BRIEF-fcc-p0-3-duck-export EXIT=1 twice (max_turns 40). Do NOT code PreviewPlayer yourself unless a one-file surgical plan needs a tiny stub — prefer write a thinner FCC-ready GRUNT brief.

## Read
- `_cos-runs/PAID-NEXT-BRAIN.md`
- `_cos-runs/EPIC-plan.md` live mixer section
- `src/core/audio/PreviewPlayer.ts` (read-only)
- `src/test/live-mixer-preview.test.ts` failing case: gain changes Play buffer vs renderRemixedWavBlob DSP (expected ~0.1559 < 0.01) — flagged pre-existing

## Deliver (write `_cos-runs/PAID-P0-3-THIN.md`)
1. Root-cause why FCC blew 40 turns on duck-export (scope fat? wrong files?).
2. Split remaining live-mixer / export punch work into at most 2 tiny FCC BRIEFs with hard file ownership, concrete acceptance, and verify commands — each must fit ~20 turns.
3. Diagnose the `live-mixer-preview` gain DSP flake: is it real product bug or test tolerance? Exact fix recipe for FCC (or close as WONTFIX with evidence).
4. Rank next north-star product P0 after HelpTips land.

## Constraints
- No dual-writer: FCC owns HelpTips files this turn — do not edit helpCopy/SectionTimeline/helptip.test.
- Prefer brain docs over code. If you must touch code, only the failing test or a pure helper — never mid-flight HelpTips files.
- Verify: `npx tsc --noEmit` green. Note test status honestly (soft-pass forbidden).
