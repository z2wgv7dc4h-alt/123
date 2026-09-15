# FCC GRUNT — HelpTips P0-A dead keys (thin)

From `_cos-runs/PAID-NEXT-BRAIN.md` P0-A. Soft-pass forbidden.

## Do
1. Delete dead HELP keys from `src/ui/lib/helpCopy.ts`: `powerMode`, `moreControls`, `badgeWebApp`, `timeline` (object + SIMPLE_HELP_KEYS / any key list).
2. Update `src/test/helptip.test.ts` key lists (incl. "covers P0 wire targets" ~43-103) so they match.
3. `npm.cmd test -- --run src/test/helptip.test.ts` then full `npm.cmd test -- --run` + `npx.cmd tsc --noEmit`.
4. Write `_cos-runs/FCC-HELPTIPS-P0A-RESULT.md` with EXIT notes.

## Files ONLY
`src/ui/lib/helpCopy.ts`, `src/test/helptip.test.ts`, result md.
## Out
P0-B copy rewrites, SectionTimeline, PreviewPlayer, OfflineStub, paid docs.
