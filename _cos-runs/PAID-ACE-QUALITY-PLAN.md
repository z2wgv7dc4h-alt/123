# PAID-ACE-QUALITY-PLAN — highest-leverage ACE Generate→Play slap on 5080 (DnB-Paid, brain)

Per `BRIEF-paid-ace-quality-brain.md`: docs/brain only. `DnB-FCC` is **live**
this session (`ACTIVE-fcc.json`: `BRIEF-fcc-ace-listen-quality.md`, started
10:47, queued next per `NEXT-FCC.md` → `BRIEF-fcc-ace-listen-shell.md`) — no
file below was edited, only read, and every new brief here is scoped to stay
off whatever FCC is touching this pass or next.

## Ground truth read directly from code this session (not from prior docs)

- `src/core/backends/AceStepBackend.ts` already sends `inferenceSteps: 50`,
  `guidanceScale: 7.0`, `shift: 3.0`, `checkpointId: 'acestep-v15-base'`
  (`:173-205`) — matches CANON's steps≈50/guidance≈7/shift≈3/base pins. **No
  `thinking` field is sent at all** — this is exactly what
  `BRIEF-fcc-ace-listen-quality.md` item 2 is live on right now; not
  duplicated here.
- `src/core/registry/BackendRegistry.ts` `selectBest()` (`:37-48`) already
  correctly prefers `ace-step` when `probe().hasGpu` is true, falling back to
  `offline-stub` otherwise — reads correct as written. Whatever silent-stub
  regression `BRIEF-fcc-ace-listen-quality.md` item 1 is chasing is elsewhere
  in the call path (likely `useStudioStore.ts`'s own generate-time backend
  selection) — FCC's live territory, not re-audited here to avoid dual-write.
- `_cos-runs/FCC-ACE-PROVE-RESULT.md`: GPU path independently proven —
  `:8766`/`:8001` healthy, `hasGpu: true`, a real render returned
  `gpuUsed: true`, `checkpointId: acestep-v15-base`, real WAV bytes. Primary
  path works end to end today.
- Two new, concrete, ACE-specific gaps found by reading the current tree
  (not by trusting any prior doc) — see queue below.

## Ordered queue (thin, hard-disjoint, run after FCC's current pipeline)

FCC's own queue right now is: `ace-listen-quality` (LIVE) →
`ace-listen-shell` (queued, per `NEXT-FCC.md`). Both new briefs below must
run **after** that pair EXITs, in the order listed, because each one shares
a file with one of FCC's in-flight briefs:

### 1. `BRIEF-fcc-ace-checkpoint-honesty.md`
- **Blocks on:** `ace-listen-quality` EXIT (same file, `AceStepBackend.ts`).
  Safe to run in parallel with `ace-listen-shell` (disjoint files) if a
  second FCC lane is ever available, but default to serial.
- **Gap:** `AceStepBackend.ts:305` and `:320` both fall back to
  `checkpointId: String(data.checkpointId || 'acestep-v15-turbo')` if the
  bridge response omits the field — but the job that was actually sent
  requested `'acestep-v15-base'` (`:205`). If the bridge ever omits
  `checkpointId` in its response, the manifest/UI will claim the *turbo*
  checkpoint ran when *base* was what was requested and (per
  `FCC-ACE-PROVE-RESULT.md`) is what's actually installed/healthy — a
  provenance lie, the same class of bug CLAUDE.md's honesty rule targets.
  Confirmed untested: `src/test/ace-backend-render.test.ts:47` always sets
  `checkpointId: 'acestep-v15-turbo'` explicitly in its mock response, so the
  fallback branch has zero coverage today.

### 2. `BRIEF-fcc-ace-generating-copy.md`
- **Blocks on:** `ace-listen-shell` EXIT (same file, `SectionTimeline.tsx`).
- **Gap:** `SectionTimeline.tsx:159,164,168` shows generic `"Generating
  sketch…"` / `"Building stems on the ~174 BPM song layout — hang tight"` /
  `aria-valuetext="Creating your sketch"` for **every** in-flight generate,
  regardless of which backend is actually running. `useStudioStore.ts`
  already sets `backendId` (`ace-step-1.5` vs `offline-stub`) and
  `aceHasGpu` *before* the async render call resolves (`:904-914`,
  `:987-997`), so the data needed to distinguish is already in the store —
  this is a copy/read fix, not new plumbing. Two real problems this causes:
  1. It calls the *primary, real-GPU, Studio-quality* ACE path a "sketch,"
     directly undercutting the product bar's own framing of ACE as primary.
  2. ACE renders (steps≈50, real GPU inference) take meaningfully longer
     than OfflineStub's near-instant synth — a user staring at "hang tight"
     with no backend-aware wording has no signal whether 30-90s is normal or
     the app is stuck.

## Non-goals this pass (explicit, per this brief's scope)

- Not touching `AceStepBackend.ts`'s `thinking` field, `useStudioStore.ts`'s
  `hasGpu`/`selectBest` call path, or anything under `ace-listen-shell`'s
  map-sync/Expand/Vary scope — FCC-owned this pass and next.
- Not HelpTips (separate, already-closed/queued track per
  `PAID-P1-NEXT.md`/`PAID-VERIFY-P1.md`).
- Not `OfflineStubBackend.ts`/`PreviewPlayer.ts` duck/export-parity
  archaeology (`CRITIC-LISTEN-PASS.md` P0-3 track) — explicitly excluded by
  this brief's "no OfflineStub archaeology" line, own track, own owner.
- `_cos-runs/BRIEF-fcc-drop-silence.md` already exists (written by an
  earlier session, not this one), targets `StructureEngine.ts` only, and is
  disjoint from both new briefs above — flagging that it's sitting
  unqueued in `NEXT-FCC.md`'s chain as a legitimate insert point (before or
  after this pair, doesn't matter, no file overlap), not proposing new work.

## Verify

No `npm.cmd test -- --run` / `npx tsc --noEmit` run this session — brief
scope is docs/brain only, no `src/` file was edited. Each new BRIEF below
carries its own hard verify gate to run in the FCC session that executes it.
