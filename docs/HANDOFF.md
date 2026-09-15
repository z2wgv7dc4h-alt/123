# Handoff — read this first

**Studio (ACE-Step 1.5, real GPU on the user's RTX 5080) is the real
generation path. Sketch (OfflineStubBackend, pure CPU Float32Array
synthesis) is a CPU fallback, not a creative sandbox that feeds into
Studio.** They share only the deterministic arrangement skeleton
(`structureEngine.plan()` — same seed+knobs gives the same song shape on
either backend); nothing composed or synthesized in one transfers to the
other. If you're deciding where to spend effort and it's ambiguous, Studio
wins unless the ticket says otherwise.

**Last commit as of this handoff: `f9c6176`** —
"Layer real Amen/Funky Drummer break loops under Sketch drops
(amen/twoStep families)". `git log --oneline -5` to confirm you're
looking at the same state; if not, something moved since this was
written — reconcile before trusting anything below.

**Full session history**: `docs/SESSION-DUMP.md` — chronological, per-
workstream, cites what landed, what was discussed but not built, and
exact test coverage gaps. Read it before re-deriving anything; this file
is deliberately short, that one is deliberately complete.

**Next work**: `TICKETS/01.md` through `08.md`, in that numeric order
(open test/coverage gaps first, then Studio audio2audio → extract → DCW,
then Sketch leftovers). One ticket, one session, one PR-sized change.
Each has File / Change / Do not / Done when / Verify — don't start work
that isn't in a ticket without adding a ticket for it first (see
`AGENTS.md`: lead writes tickets).

## Files that matter

**Shared arrangement (both backends)**
- `src/core/structure/StructureEngine.ts` — `HardGridStructureEngine`,
  the deterministic planner. `sectionAt`, `midiForRoot` exported for
  reuse elsewhere.
- `src/core/structure/index.ts` — barrel export, keep in sync when
  adding exports to `StructureEngine.ts`.

**Studio (ACE)**
- `src/core/backends/AceStepBackend.ts` — talks to the local bridge.
- `sidecar/ace_bridge_server.py` — local bridge (`:8766`) → real ACE API
  (`:8001`, from `acestep-api`, cloned by `scripts/windows/*.ps1`).
- `C:\Users\RIGGUSPIG\Documents\ACE-Step-1.5` — the real, installed
  ACE-Step-1.5 repo, **not part of this repo, not vendored**. Ground
  truth for the real API surface: `acestep/api/http/
  release_task_models.py`, `acestep/constants.py`, and `docs/en/*.md`
  (`API.md`, `DCW.md`, `LoRA_Training_Tutorial.md`, `GRADIO_GUIDE.md`,
  more — see that repo's `docs/en/index.md`). Fully offline-readable —
  prefer these over a web search if a future session has no internet.
- `src/core/prompt/buildAceCaption.ts` — ACE caption/tag builder.

**Sketch (OfflineStub)**
- `src/core/backends/OfflineStubBackend.ts` — all CPU synthesis;
  `buildRealBreakBus` is the newest addition (real sample loop mixing).
- `src/core/audio/wavDecode.ts`, `loadBreakLoop.ts`, `node-fs-shim.d.ts`
  — dependency-free WAV decode/load, dual Node+browser.
- `src/assets/samples/breaks/*.wav` + `LICENSE_*.txt` — the real KAN
  Samples break loops and their actual license terms (read the `.txt`
  files directly, don't trust a landing page's blurb — see
  `docs/SESSION-DUMP.md` §6 for why that distinction mattered).

**UI**
- `src/ui/hooks/useStudioStore.ts` — Zustand store, `generate()`
  orchestrates both backends.
- `src/ui/components/StyleDropZone.tsx` — "Optional vibe" upload;
  ticket 04 will need its copy rewritten once audio2audio lands.
- `src/ui/components/LayersChips.tsx` — `CPU_CAPABLE` set; the pattern
  ticket 08 should follow for a real-break toggle.

**Docs**
- `docs/SESSION-DUMP.md` — full session inventory (read first).
- `docs/STATUS.md` — older chronological log, still has evidence
  citations worth keeping; `SESSION-DUMP.md` is now the primary summary.
- `docs/ARCHITECTURE.md` — includes the Tone.js-not-as-synth-engine
  rationale (asked about directly this session, documented there).
- `README.md`, `docs/ACCEPTANCE.md` — licensing relaxation reflected.
- `AGENTS.md` / `CLAUDE.md` — the law. Read `AGENTS.md`.

## Don't do

Full list with the *why* for each: `docs/SESSION-DUMP.md` §6. The two
most likely to bite you immediately:
- **Don't install `@types/node`** — this tsconfig has no `types` array,
  so it would auto-leak Node globals project-wide. Use a narrow local
  ambient `.d.ts` (see `src/core/audio/node-fs-shim.d.ts`).
- **Don't run `git filter-branch`/`git remote add` from Claude Code's own
  shell tool** — both are hard-blocked by the auto-mode classifier. Write
  the script, have the user run it.
