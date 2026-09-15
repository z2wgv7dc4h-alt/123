# PAID P0-1 relaunch — result

Scope per `BRIEF-paid-p0-1-expand-rng.md`: fix ONLY
`src/core/structure/StructureEngine.ts` so Expand/×2 keys drum+bass RNG
per-section, and harden ONLY `src/test/structure-expand.test.ts` +
`src/test/listen-expand.test.ts` to diff unedited-section hit arrays.

## Finding: fix already present in the tree

On opening `StructureEngine.ts`, the per-section RNG fix described in
`CRITIC-LISTEN-PASS.md` P0-1 was already implemented, not missing:

- `src/core/structure/rng.ts:30-37` — new `sectionSeed(baseSeed, index)`, an
  independent 32-bit hash of `(seed, sectionIndex)`.
- `src/core/structure/StructureEngine.ts:449-500` — `plan()` no longer threads
  one sequential `rng()` through `planDrums`/`planBass` across the whole bar
  range. Each section gets its own `mulberry32(sectionSeed(seed, i))` and
  plans its drums/bass independently (against a `localSections` array
  reindexed to start at bar 0), then hits are re-offset by `sec.startBar`
  before being merged. Song-identity picks (`keyRoot`, `patternFamily`,
  `bassCharacter`) are still drawn once, in fixed order, from the top-level
  `rng` before section planning — comment at `:419-423` explains why (stable
  across Expand/Repeat since those skip `planSections` via `sectionsOverride`).
- Both test files already contained the hardened assertions: a
  `sectionContent()` helper that extracts each section's drum hits + bass
  notes normalized to section-relative bars, and P0-1-labeled tests
  (`structure-expand.test.ts:126-167`, `listen-expand.test.ts:107-189`) that
  expand one section and assert every *other* section's `sectionContent()` is
  `toEqual` byte-identical before/after — not just that seed/`editedSections`
  survive.

Given the brief's own framing ("Prior run EXIT=1 max_turns; no
PAID-P0-1-RESULT.md"), the most likely explanation is a previous session
implemented this exact fix and test hardening, then ran out of turns before
writing this result file. No further code change was needed to satisfy the
brief's Do items 1-3; this session's work was verification (items 4-5).

## Verify

- `npm.cmd test -- --run src/test/structure-expand.test.ts
  src/test/listen-expand.test.ts`: **green** — 2 files, 16/16 passed,
  including the two P0-1 byte-identical-hit-array tests.
- `npm.cmd test -- --run` (full suite): **37/38 files green, 227/230 tests
  passed, 2 skipped, 1 failed.** The one failure is
  `src/test/live-mixer-preview.test.ts > fallback loadMixFromStems ≡ Play
  buffer ≡ renderRemixedWavBlob > gain changes Play buffer; matches
  renderRemixedWavBlob DSP within 16-bit tol` (`expected 0.07043838500976562
  to be less than 0.01`). This is P0-3/PreviewPlayer/live-mixer territory —
  explicitly listed as **Out** in this brief ("PreviewPlayer, OfflineStub,
  export, SectionTimeline, P0-3, CSS, ACE. No other files.") — and no file in
  that area was touched this session. Not claiming this green per the
  project's soft-pass-forbidden rule; flagging it as pre-existing and
  out-of-scope for P0-1 rather than silently ignoring it.
- `npx tsc --noEmit`: **not verified** — denied at the sandbox permission
  layer for every invocation tried this session (`npx.cmd tsc --noEmit` via
  Bash, `npx tsc --noEmit` via PowerShell), same restriction the prior
  `CRITIC-LISTEN-PASS.md` session hit and documented (GRUNT note #3: "no
  approval surface available here"). Zero files were edited this session
  (verification-only), so there is no new type-risk surface introduced by
  this pass specifically.

## Files touched this session

None — `StructureEngine.ts` and both test files already matched the brief's
required end state on inspection. This document was added
(`_cos-runs/PAID-P0-1-RESULT.md`) to close out the brief per its own item 5.
