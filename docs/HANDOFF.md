# Handoff — Opus pickup

**Last commit**: `b4d3ac5` — "handoff: full session dump + tickets".
Working tree clean at time of writing. `git log --oneline -3` to confirm.

**Orientation**: Studio (ACE-Step 1.5, real GPU on an RTX 5080) is the
real generation path. Sketch (`OfflineStubBackend`, pure CPU
Float32Array synthesis) is a fallback — the two share only the
deterministic arrangement skeleton (`structureEngine.plan()`), nothing
else transfers between them.

**Deep history**: `docs/SESSION-DUMP.md` (chronological, per workstream,
with evidence). This file is the short pickup + the gap list being
worked next. `TICKETS/01.md`–`08.md` hold longer-form specs; the gap
list below supersedes their ordering.

## Landed (on disk, verified)

- Silent ACE→Sketch fallback bug fixed (`useStudioStore.ts` no longer
  double-probes via `selectBest()`).
- Section structure now reaches ACE (`AceStepBackend.ts` sends
  `structureRef.sections`; `ace_bridge_server.py` maps to lyric tags).
- ACE caption rewritten with real DnB vocabulary + duplicate-tag dedup
  bug fixed (`buildAceCaption.ts`).
- Sketch composition/synthesis: bass voice leading (`nearestOctaveTo`),
  guitar/lead/rock-mid key-following (`midiForRoot`), hi-hat density
  (16ths baseline, 32nds only on fills), kick/snare/hat rebuilt on RBJ
  bandpass biquads, reese/growl as detuned saw stacks, reese detune
  widened to ~±17/±31 cents.
- Dubstep vs half-time-drop differentiated (was byte-identical), then a
  second RNG-correlation bug in that same fix found and fixed.
- Real breakbeat loops layered under drop bars for `amen`/`twoStep`
  families: `wavDecode.ts`, `loadBreakLoop.ts`, `node-fs-shim.d.ts`,
  `buildRealBreakBus()` in `OfflineStubBackend.ts`, assets in
  `src/assets/samples/breaks/`. User confirmed by ear.
- Git history name scrub completed and force-pushed (closed, done).
- UI: Club/Rave palette, sticky listen-first panel, CPU-capable layer
  gating.

## Discussed, NOT built

- ACE audio2audio (`task_type: "cover"`) for the Style Ref upload — the
  upload is still reduced to 3 scalar knob nudges, real audio discarded.
  Full API spec (multipart field names, `audio_cover_strength` ≈0.2) in
  `docs/SESSION-DUMP.md` and `TICKETS/04.md`.
- ACE `extract` for real separated stems — stems still mirror the mix
  blob (honestly labeled). `TICKETS/05.md`.
- DCW — silently off on the non-Turbo base model this project uses.
- LoRA training — researched, specs known, not started.
- `use_adg`, custom `timesteps` — unexplored.
- Raw non-pre-cut sample files (175/105 BPM) — need real tempo work.

## Legal

Personal, non-commercial project. The sample packs and breaks already
committed to this repo are fine to use and ship in-repo. Forbidden,
unchanged: an artist-clone product (impersonating a specific named
artist), and presenting fake ACE stems as real isolated stems — if
stems share the mix blob, say so (that honesty label must stay accurate
until `extract` actually lands).

## Don't-do (technical)

- **No git history rewriting.** That thread is closed and verified. Do
  not run `filter-branch`, rebase-rewrites, or force-push over history.
- **No `@types/node`.** This tsconfig has no `types` array, so it would
  auto-leak Node globals into every browser-side file. Use a narrow local
  ambient `.d.ts` — see `src/core/audio/node-fs-shim.d.ts`.
- **No song renders to "verify".** Verification is a targeted test or
  `tsc`. Render audio only when a gap's Verify line explicitly names a
  file as the deliverable.
- Don't run `git filter-branch`/`git remote add` from the agent shell —
  hard-blocked by the tool classifier regardless.

## GAP LIST — next 10, in order

| # | Gap | File(s) | Verify |
|---|---|---|---|
| 1 | `prove-gpu.test.ts` fails whenever the ACE stack is down, so the suite is never green offline. Skip those cases unless a live probe answers. | `src/test/prove-gpu.test.ts` | `npx vitest run src/test/prove-gpu.test.ts` |
| 2 | No test asserts dubstep ≠ half-time-drop; the bug shipped twice and was caught only by manual render. | new `src/test/song-shape-divergence.test.ts` | `npx vitest run src/test/song-shape-divergence.test.ts` |
| 3 | `buildRealBreakBus` is module-private and untested at the integration point — nothing catches its call site being removed. Export it, assert drop bars gain energy and non-drop bars don't. | `src/core/backends/OfflineStubBackend.ts`, new `src/test/real-break-mix.test.ts` | `npx vitest run src/test/real-break-mix.test.ts` |
| 4 | Real sample content has no manifest honesty label, unlike every other special-case source (styleRef, perc, guitar). | `src/core/export/manifest.ts`, `src/core/backends/OfflineStubBackend.ts`, test | `npx vitest run src/test/real-break-mix.test.ts` |
| 5 | `REAL_BREAK_GAIN` is a hardcoded always-on `0.32` with no way to disable/adjust; also blocks a clean A/B in gap 3. | `src/core/backends/OfflineStubBackend.ts`, `src/core/types/index.ts`, `src/ui/hooks/useStudioStore.ts`, `src/ui/components/LayersChips.tsx` | `npx vitest run src/test/simple-process-order.test.ts` |
| 6 | `AceStepBackend.ts:167` hardcodes `breakDensity: 0.55` while `OfflineStubBackend` derives it from chaos — the "shared" arrangement isn't actually identical across backends for one seed. | `src/core/backends/AceStepBackend.ts`, test | `npx vitest run src/test/ace-backend-render.test.ts` |
| 7 | DCW is off by default on `acestep-v15-base` and never sent. Wire `dcwEnabled`/`dcwMode` through backend → bridge as named params. | `src/core/backends/AceStepBackend.ts`, `sidecar/ace_bridge_server.py` | `npx tsc --noEmit && npx vitest run src/test/ace-backend-render.test.ts` |
| 8 | ACE inference params (`inferenceSteps: 50`, `guidanceScale: 7.0`, `shift: 3.0`) are bare literals at the call site with no named constants or test coverage. | `src/core/backends/AceStepBackend.ts`, test | `npx vitest run src/test/ace-backend-render.test.ts` |
| 9 | Audio2audio plumbing: backend sends the Style Ref `File` and `task_type: "cover"` + `audio_cover_strength`; bridge accepts multipart and forwards as `src_audio`. Payload shape testable without a GPU. | `src/core/backends/AceStepBackend.ts`, `sidecar/ace_bridge_server.py`, `src/ui/hooks/useStudioStore.ts` | `npx vitest run src/test/ace-backend-render.test.ts` |
| 10 | `StyleDropZone.tsx` still promises "Not a clone / we bias mood and energy" — dishonest once gap 9 lands. Copy must change in the same pass. | `src/ui/components/StyleDropZone.tsx`, `src/ui/lib/helpCopy.ts` | `npx vitest run src/test/style-reference.test.ts` |

Research-only, therefore tickets not gaps: `extract` stems
(`TICKETS/05.md`), LoRA training, raw-sample tempo work
(`TICKETS/07.md`).
