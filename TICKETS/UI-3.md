# UI-3 Demote Export, second Vary, Surprise Me ×2, style-pack train behind More

**Status: Done** `da3625f`, `313beaf`.

File: `src/ui/components/TransportBar.tsx`, `src/ui/components/RegenAffordance.tsx`, `src/ui/components/PostExportStrip.tsx`, `src/ui/components/LayersChips.tsx`, `src/ui/components/FavoritesPanel.tsx`, `src/ui/components/SurpriseMeButton.tsx`, `src/ui/components/PowerExtras.tsx`, `src/App.tsx`, `src/test/e2e-invariants.test.ts`

Change: The primary row keeps only Play, Stop, Generate and Vary. Move these into More, keeping exactly one of each:
- Export ZIP, Download heard, bit depth (`TransportBar.tsx:333-415`). Drop the duplicate bit-depth picker in `PowerExtras.tsx:57` and the duplicate Download heard in `StemMixer.tsx:216`.
- Remove the second Vary everywhere: `TransportBar.tsx:489-500`, `RegenAffordance.tsx:66-77`, `PostExportStrip.tsx:67-75`, `LayersChips.tsx:100-102`.
- Keep one Surprise Me (`SurpriseMeButton`) in More, and remove the empty-state copy at `FavoritesPanel.tsx:117-138`.
- Put the style-pack select and "Request style-pack train (GPU)" (`PowerExtras.tsx:170-214`) behind a collapsed stub disclosure inside More.

Do not: change `exportStems`, `vary`, `generate` or `loraPackManager`
behaviour. Do not add LoRA wiring. Do not change the Again hotkey (R) or the
Vary hotkey (V).

Done when: with a result loaded and More closed, the only visible transport
buttons are Play, Stop, Generate and Vary. With More open, Export, Surprise Me
and style-pack train each appear exactly once. A test counts the `vary()` click
targets outside More as 1.

Verify: `npx vitest run src/test/e2e-invariants.test.ts && npm.cmd test -- --run && npx tsc --noEmit`
