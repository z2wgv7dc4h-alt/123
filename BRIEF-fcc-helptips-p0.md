# BRIEF-fcc-helptips-p0 — FCC GRUNT (mechanical)

Source: `_cos-runs/PAID-NEXT-BRAIN.md` FCC GRUNT handoff. Design decided — do not re-litigate.
Do NOT reopen BRIEF-fcc-p0-3-duck-export (already EXIT=1 twice / max_turns).

## Files ONLY
- `src/ui/lib/helpCopy.ts`
- `src/ui/components/SectionTimeline.tsx`
- `src/test/helptip.test.ts`

**Do not open** `PreviewPlayer.ts`, `OfflineStubBackend.ts`, `ducking.ts`, or anything under `src/core/audio/`.

## Do
1. **P0-A**: Delete dead HELP keys `powerMode`, `moreControls`, `badgeWebApp`, `timeline` from HELP object + `SIMPLE_HELP_KEYS`. Drop `moreControls`/`badgeWebApp` from `helptip.test.ts` key list.
2. **P0-B**: Add `expandSection`, `repeatSection`, `dropX2` keys (What:/When:/What happens:, max 160 chars). Each MUST state: only this section changes; same seed; rest of song stays. Add to `SIMPLE_HELP_KEYS`. Wire onto Expand/Repeat/A-2 HelpTips in `SectionTimeline.tsx` (~239-279) only — leave other `HELP.sectionTimeline` sites alone.
3. **P1-A**: Rewrite `HELP.stems` + `HELP.glossaryStem` to name all 5 elementals (kick/snare/hats/perc/bass) and explain `drums`/`mix` as combined bus rows.

## Done
`npm.cmd test -- --run` AND `npx tsc --noEmit` green. Soft-pass forbidden.
