# FCC GRUNT — HelpTips P1-A stems copy (thin)

From `_cos-runs/PAID-P1-NEXT.md` §1c. Soft-pass forbidden.

## Do
1. In `src/ui/lib/helpCopy.ts` rewrite `stems` and `glossaryStem` to name all 5 elementals (kick/snare/hats/perc/bass) and note that `drums`/`mix` are combined buses (Mute/Solo like elementals), not extra parts.
2. Keep `stems` ≤160 chars (it is in SIMPLE_HELP_KEYS). Draft start point in PAID-P1-NEXT — verify length against helptip.test, don't eyeball.
3. Keep glossaryStem's Dry / mix_as_heard clause; only fix stem list + buses.
4. `npm.cmd test -- --run src/test/helptip.test.ts` then full `npm.cmd test -- --run` + `npx.cmd tsc --noEmit` — all green. Soft-pass on tsc forbidden.
5. Write `_cos-runs/FCC-HELPTIPS-P1A-STEMS-RESULT.md` with EXIT notes.

## Files ONLY
`src/ui/lib/helpCopy.ts`, result md. Touch `helptip.test.ts` only if a length/key assert forces it.

## Out
SectionTimeline, PreviewPlayer, OfflineStub, zip/honesty tests, paid docs, re-opening dead-key P0-A.
