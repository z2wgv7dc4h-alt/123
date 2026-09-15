# PAID P0-1 relaunch (max_turns FAIL once) — StructureEngine ONLY

Prior run EXIT=1 max_turns; no PAID-P0-1-RESULT.md. Stay narrow.

## Do (strict order)
1. Read CRITIC-LISTEN-PASS.md P0-1 once.
2. Fix ONLY `src/core/structure/StructureEngine.ts`: Expand length must not rewrite unedited sections drums+bass — per-section RNG (mulberry32(seed, sectionIndex)).
3. Harden ONLY `src/test/structure-expand.test.ts` + `src/test/listen-expand.test.ts` (diff unedited hit arrays).
4. `npm.cmd test -- --run` then `npx.cmd tsc --noEmit`.
5. Write `_cos-runs/PAID-P0-1-RESULT.md` before stopping (EXIT notes). Soft-pass forbidden.

## Out
PreviewPlayer, OfflineStub, export, SectionTimeline, P0-3, CSS, ACE. No other files.
