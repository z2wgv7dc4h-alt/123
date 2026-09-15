# Handoff

**Last commit before implementation**: `557f279` — "docs: opus handoff".
Studio (ACE-Step 1.5, GPU) is the real path; Sketch (`OfflineStubBackend`,
CPU) is the fallback. They share only `structureEngine.plan()`.

Archived, non-binding docs: `docs/_archive_2026-09-16/`. Research-only
work stays as tickets: `TICKETS/05.md` (ACE extract stems),
`TICKETS/07.md` (raw-sample tempo work). LoRA is out of scope.

## Don't do

- **No git history rewriting.** That thread is closed and verified.
- **No `@types/node`.** This tsconfig has no `types` array, so it would
  leak Node globals into every browser-side file. Use a narrow local
  ambient `.d.ts` — see `src/core/audio/node-fs-shim.d.ts`.
- **No song renders to "verify".** Verification is a targeted test or
  `tsc`, unless a gap's Verify line names a file as the deliverable.
- No LoRA, no extract stems, no raw Downloads wav import, no new gaps.

## GAP LIST

| # | Gap | File(s) | Verify |
|---|---|---|---|
| 1 | `prove-gpu.test.ts` fails whenever the ACE stack is down, so the suite is never green offline. Skip those cases unless a live probe answers. | `src/test/prove-gpu.test.ts` | `npx vitest run src/test/prove-gpu.test.ts` |
| 2 | No test asserts dubstep ≠ half-time-drop; that bug shipped twice, caught only by manual render. | new `src/test/song-shape-divergence.test.ts` | `npx vitest run src/test/song-shape-divergence.test.ts` |
| 3 | `buildRealBreakBus` is module-private and untested at the integration point — nothing catches its call site being removed. | `src/core/backends/OfflineStubBackend.ts`, new `src/test/real-break-mix.test.ts` | `npx vitest run src/test/real-break-mix.test.ts` |
| 4 | Real sample content has no manifest honesty label, unlike styleRef/perc/guitar. | `src/core/export/manifest.ts`, `src/core/backends/OfflineStubBackend.ts` | `npx vitest run src/test/real-break-mix.test.ts` |
| 5 | `REAL_BREAK_GAIN` is a hardcoded always-on `0.32` with no way to disable or adjust. | `src/core/backends/OfflineStubBackend.ts`, `src/core/types/index.ts`, `src/ui/hooks/useStudioStore.ts`, `src/ui/components/LayersChips.tsx` | `npx vitest run src/test/simple-process-order.test.ts` |
| 6 | `AceStepBackend.ts` hardcodes `breakDensity: 0.55` while Sketch derives it from chaos — the "shared" arrangement isn't shared. | `src/core/backends/AceStepBackend.ts` | `npx vitest run src/test/ace-backend-render.test.ts` |
| 7 | DCW is off by default on `acestep-v15-base` and never sent. Wire `dcwEnabled`/`dcwMode` backend → bridge. | `src/core/backends/AceStepBackend.ts`, `sidecar/ace_bridge_server.py` | `npx tsc --noEmit && npx vitest run src/test/ace-backend-render.test.ts` |
| 8 | ACE inference params (`50`/`7.0`/`3.0`) are bare literals with no named constants or coverage. | `src/core/backends/AceStepBackend.ts` | `npx vitest run src/test/ace-backend-render.test.ts` |
| 9 | Audio2audio plumbing: send the Style Ref file + `task_type: "cover"` + `audio_cover_strength`; bridge accepts multipart as `src_audio`. Payload shape is testable without a GPU. | `src/core/backends/AceStepBackend.ts`, `sidecar/ace_bridge_server.py`, `src/ui/hooks/useStudioStore.ts` | `npx vitest run src/test/ace-backend-render.test.ts` |
| 10 | `StyleDropZone.tsx` promises "Not a clone / we bias mood" — dishonest once gap 9 lands. Copy changes in the same pass. | `src/ui/components/StyleDropZone.tsx`, `src/ui/lib/helpCopy.ts` | `npx vitest run src/test/style-reference.test.ts` |
