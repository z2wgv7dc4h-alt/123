# UI-2 One layout — remove Simple vs Power as two products

File: `src/App.tsx`, `src/ui/components/TransportBar.tsx`, `src/ui/components/Waveform.tsx`, `src/ui/components/SimpleWant.tsx`, `src/ui/hooks/useStudioStore.ts` (`mode`, `setMode`), `src/test/e2e-invariants.test.ts`

Change: Delete the Simple/Power toggle (`App.tsx:89-113`) and merge the two
trees (`App.tsx:130-159`, `:162-180`) into one: the transport cluster first,
then waveform + song map, then everything else behind the single More toggle.
Remove the numbered labels `1 · Generate`, `2 · Play`, `3 · Export Sketch ZIP`
(`TransportBar.tsx:257-261`, `:282`, `:348`), `1 · Generate` (`Waveform.tsx:370`)
and the `step-num` "1" in `SimpleWant.tsx:18`. A persisted `mode` from
localStorage must load without error and be ignored.

Do not: change any handler or button contract. Do not decide what goes behind
More (that is UI-3). Do not delete `e2e-invariants` assertions; rewrite them for
the single layout.

Done when: no element renders the text "Simple" or "Power" as a layout toggle;
`grep -rn "[123] · " src/ui` returns nothing; `App.tsx` has no `isSimple`
branch; old saved state still loads.

Verify: `npx vitest run src/test/e2e-invariants.test.ts && npm.cmd test -- --run && npx tsc --noEmit`
