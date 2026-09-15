# UI-1 Move Play/Stop next to Generate/Vary

File: `src/ui/components/TransportBar.tsx`; new `src/test/transport-cluster.test.ts`

Change: Reorder the `#transport` toolbar so that `btn-play`, `btn-stop`,
`btn-generate` and `btn-vary-primary` are adjacent, in that order, inside one
group element (e.g. `role="group" aria-label="Play controls"`). Keep the same
handlers: `play()`, `stop()`, `generate()`, `vary()`. Keep the existing
disabled logic (`canPlayPreview`, `previewState !== 'playing'`, `!canGenerate`)
and the existing labels.

Do not: move, remove or relabel Export, Download heard, bit depth, the vary-row
(Again/Vary/Previous), coaches, the clock or the pill. Do not touch
`App.tsx`, the store, or Simple/Power. Do not add buttons.

Done when: the rendered transport shows Play, Stop, Generate and Vary in one
contiguous group with no other control between them, and every handler is the
same function reference as before.

Verify: `npx vitest run src/test/transport-cluster.test.ts && npx tsc --noEmit`
