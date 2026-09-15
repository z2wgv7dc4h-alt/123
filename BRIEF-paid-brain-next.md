# PAID BRAIN — next north-star after P0-1 (NO soft-pass)

Context: P0-1 Expand RNG DONE (EXIT=0, `_cos-runs/PAID-P0-1-RESULT.md`). FCC LIVE owns P0-3 duck/export (`OfflineStubBackend.ts`, `PreviewPlayer.ts`, `ducking.ts` + related tests/docs). Stay OFF those files.

## Do (hard brain only)
1. Read NORTH-STAR + `_cos-runs/CRITIC-LISTEN-PASS.md` + `_cos-runs/PRODUCT-MAP.md` + `docs/ux-must-fixes-player-length.md` if present.
2. Adversarial listen-first pass on **disjoint** areas FCC is NOT touching:
   - HelpTips teach quality (`HelpTip.tsx`, `helpCopy.ts`, usages) — jargon, missing What/When/What happens, dead keys
   - Player-length readability / transport UX
   - Live mute/solo/gain Channel *UX honesty* (UI + store wiring only — not PreviewPlayer DSP)
   - Expand/Vary/seed product copy vs CLAUDE bar
3. Write `_cos-runs/PAID-NEXT-BRAIN.md` with: verified gaps (file:line), ranked P0/P1, and a **FCC GRUNT handoff list** with hard-disjoint file paths (must not include OfflineStub/PreviewPlayer/ducking while FCC owns P0-3; StructureEngine OK only if new work beyond closed P0-1).
4. Soft-pass forbidden. Cite real code. Prefer design + GRUNT specs over coding.

## Out
Touching PreviewPlayer / OfflineStub / ducking / mix-as-heard while FCC LIVE; dual-write; ops archaeology; claiming product done without named gaps or an empty honest "nothing left" verdict with evidence.

## Verify
Docs-only OK if no src/. If you edit src (avoid unless tiny HelpTips copy fix), then `npm.cmd test -- --run` + `npx tsc --noEmit` green.
