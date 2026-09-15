# FCC GRUNT — backend-aware "Generating…" copy (thin, listen-first)

Soft-pass forbidden. Run AFTER `ace-listen-shell` EXITs (same file).

## Gap
`src/ui/components/SectionTimeline.tsx` (~L156-171, empty-state busy view)
shows generic copy for every in-flight generate regardless of backend:
- `"Generating sketch…"` (~L159)
- `"Building stems on the ~174 BPM song layout — hang tight"` (~L164)
- `aria-valuetext="Creating your sketch"` (~L168)

This mislabels the **primary** ACE/GPU path as a "sketch" (undercuts the
product bar's own framing of ACE as primary, not secondary), and gives no
signal that ACE renders (steps≈50, real GPU inference, per
`_cos-runs/FCC-ACE-PROVE-RESULT.md` real jobs run tens of seconds) take
meaningfully longer than OfflineStub's near-instant synth — a user has no
way to tell "still working" from "stuck."

`useStudioStore.ts` already sets `backendId` (`'ace-step-1.5'` vs
`'offline-stub'`) and `aceHasGpu` in state *before* the async render call
resolves (~L904-914, ~L987-997) — the data needed already exists in the
store; this is a copy/read fix in `SectionTimeline.tsx`, not new plumbing.

## Do
1. Read `backendId` (and/or `aceHasGpu`) from `useStudioStore` in
   `SectionTimeline.tsx` (same pattern as the existing `busy` selector at
   ~L64).
2. When the in-flight backend is ACE (`backendId.startsWith('ace-step')`):
   swap the three copy points above for ACE-specific wording that (a) does
   not call it a "sketch," (b) sets a realistic latency expectation, e.g.
   `"Rendering on GPU (Studio ACE)…"` / `"Real audio on your RTX 5080 —
   this takes longer than a sketch, hang tight"` / matching
   `aria-valuetext`. Keep the existing OfflineStub copy unchanged for the
   non-ACE case.
3. No new automated test expected (this repo's suite doesn't mount React
   components — confirmed by `CRITIC-LISTEN-PASS.md`'s P0-2 note: no DOM
   test environment installed). State that honestly in the result doc
   rather than inventing coverage; verify by reading the diff against the
   existing `busy` conditional pattern instead.
4. `npm.cmd test -- --run` + `npx tsc --noEmit` (note honestly if denied).
5. Write `_cos-runs/FCC-ACE-GENERATING-COPY-RESULT.md`.

## Files ONLY
`src/ui/components/SectionTimeline.tsx` (+ `src/styles/app.css` only if a
new class is genuinely needed for the ACE-specific progress copy — prefer
reusing `.gen-progress`/`.gen-progress-bar` as-is).
Out: `useStudioStore.ts` (read-only, don't touch), map/Expand/Vary logic
already owned by `ace-listen-shell`, `PreviewPlayer.ts`,
`OfflineStubBackend.ts`.
