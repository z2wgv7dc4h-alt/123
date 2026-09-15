# PAID-P0-3-THIN — root cause + 2 tiny FCC briefs for duck/export (2026-09-14)

Per `BRIEF-paid-brain-p03-thin.md`: docs over code. `PreviewPlayer.ts` was read
but **not edited** — it is explicitly read-only for this brief and the real fix
needs a redesign decision, not a one-line stub, so it goes to FCC as Brief A
below. `helpCopy.ts` / `SectionTimeline.tsx` / `helptip.test.ts` were not opened
for editing either (FCC-owned this turn).

## 0. Current verified state (ground truth, not the last doc's claim)

Ran both verify commands myself just now, in this session:

- `npx tsc --noEmit`: **RED**, 9 diagnostics, all in `src/core/audio/PreviewPlayer.ts`
  (lines 869/870/881/882/933/934/945/946 — `TS2451 Cannot redeclare block-scoped
  variable`, plus one `TS6133` unused var at 981).
- `npm.cmd test -- --run`: **20 of 38 files fail, only 2 real test failures**.
  19 of those 20 "failed" files (`e2e-invariants`, `export-bit-depth`,
  `invent-46-51`, `invent-52-63`, `invent-76-81`, `invent-82-87`,
  `listen-expand`, `live-mixer-preview`, `live-tweak-preview`, `mix-as-heard`,
  `mixer-dirty`, `params-dirty`, `section-energy`, `simple-process-order`,
  `stem-perc-a3`, `structure-expand`, `vary-chaos-nudge`, `vibe-mirror`,
  `waveform-seek`) don't run a single assertion — esbuild refuses to **parse**
  `PreviewPlayer.ts` at all (`Transform failed with 4 errors: … "bassChannelIndex"
  has already been declared`), so every test file that imports anything from
  `src/core/audio` (transitively, almost the whole suite) dies at import time.
  The other failing file, `helptip.test.ts`, has 2 real failures unrelated to
  audio (`HELP[k]` undefined for keys in `helptip.test.ts`'s key list) — that's
  FCC's mid-flight HelpTips work from `PAID-NEXT-BRAIN.md` item 1, already
  correctly out of scope for this brief; not re-diagnosed here.
- This is **materially worse** than `PAID-NEXT-BRAIN.md`'s "37/38 passed, 1
  failed" snapshot from earlier the same day — the file has been edited since,
  almost certainly by the `BRIEF-fcc-p0-3-duck-export` run that then hit
  `EXIT=1` at `max_turns 40` and left the tree in this broken intermediate
  state rather than reverting.

## 1. Root cause: why FCC blew 40 turns

Opened `src/core/audio/PreviewPlayer.ts` (`renderRemixedWavBlob`, ~L843-1016).
It contains the **entire kick→bass sidechain-duck-and-mix block, verbatim,
twice**, back to back:

- Block 1: L867-929 (comment `// Apply kick->bass sidechain ducking to match
  offline render behavior (keep bass stem dry)`, declares `bassChannelIndex`/
  `kickChannelIndex`/`bassChannelForMix`/`kickChannelForMix`, computes an
  envelope, then a mixing loop).
- Block 2: L931-998 — **identical comment, identical variable names,
  identical logic**, redeclared in the same lexical scope (same `try` block,
  no intervening braces).

`let x` declared twice in the same block is not a lint nit, it's an invalid
program — both TypeScript (`TS2451`) and the esbuild transform Vitest actually
runs through reject it outright, at parse time, before any test code executes.
Because `PreviewPlayer.ts` sits underneath nearly every audio/store test via
import chains, one file failing to parse manifests as **19 unrelated-looking
test-file failures**, not one. That is almost certainly the actual turn-burn
mechanism: an agent chasing what looks like a wide-blast-radius regression
across `structure-expand`, `vary-chaos-nudge`, `mixer-dirty`, etc. — files it
never touched and that have nothing to do with ducking — without ever
localizing that all 19 are one esbuild parse error one level up the import
graph. Each retry likely re-ran the full suite, saw the same wall of 19 "new"
failures, and kept iterating on symptoms instead of the syntax error.

Secondary contributor: even the *duplicated* logic doesn't work. Tracing
block 2 (the one that runs on already-summed data, so it's the "live" copy):
it computes `bassChannelForMix`/`kickChannelForMix` and a ducked envelope, but
the final `mixedChannels` build right after it (L976-998) sums straight from
`decoded[bi]` × `gainsLin[bi]` and **never references `bassChannelForMix` at
all** — the entire duck computation, run twice, is dead code that affects
nothing in the returned buffer. So even a version of this file that happened
to compile (e.g. if only one copy of the block existed) would still not
actually duck anything in the export/remix path. This reads like an agent
iterating "add duck to renderRemixedWavBlob," not seeing the test go green,
adding a second attempt without deleting the first, and never wiring either
attempt's result into the return value — the exact "computed and never wired
into the real call path" failure shape this project's `CLAUDE.md` already
warns about for the Metal project; same shape here.

Scope read as too fat for one 40-turn run: "make live-mixer-preview.test.ts's
gain-DSP assertion pass" implicitly required (a) noticing `loadMixFromStems`
and `renderRemixedWavBlob` are two independent hand-rolled DSP paths with no
shared helper, (b) that `loadMixFromStems`'s own duck is *also* wrong (next
section), and (c) fixing both without a shared primitive. That's a redesign,
not a bugfix — too big for one unsupervised run, which is exactly why it's
split below instead of retried as one brief again.

## 2. Split into 2 tiny FCC briefs

### Brief A — fix the duck/export DSP bug (hard-owns `PreviewPlayer.ts` only)

**Files:** `src/core/audio/PreviewPlayer.ts` only. Do not touch
`helpCopy.ts`/`SectionTimeline.tsx`/`helptip.test.ts` (still FCC's own other
mid-flight work — don't let this brief's diff collide with it) or anything
under `docs/`/`_cos-runs/` except noted in Brief B.

**Root defects to fix (both real, both present today):**

1. `renderRemixedWavBlob` (~L843-1016): delete the duplicated block entirely —
   keep exactly one duck computation, and make its result actually flow into
   the returned `mixedChannels` (today neither copy does — see §1). The duck
   must be computed from **isolated per-stem decoded audio** (`decoded[bi]`
   for the stem whose `usable[bi].id === 'kick'` / `'bass'`), not from any
   post-sum shared buffer.
2. `loadMixFromStems` (~L650-752, the native Play-buffer path): `bassChannel`
   and `kickChannel` are both assigned `channels[0]` (L691/L694) — i.e. after
   the per-stem sum loop at L675-683 already merged every stem into `channels`,
   both "kick" and "bass" end up pointing at the **same fully-mixed buffer**.
   `sameChannel` is therefore always `true`, and the code derives its duck
   envelope from the whole mix's loudness (kick+snare+hats+bass+everything)
   and overwrites the whole mix's channel 0 with the result — this is not a
   kick→bass sidechain, it's an accidental self-duck of the entire buffer.
   Fix: capture the kick and bass stems' own decoded `Float32Array`s (before
   or alongside the sum loop, from `decoded[bi]` keyed by `usable[bi].id`),
   derive the envelope from the real kick stem, and apply the duck gain only
   to the real bass stem's contribution before/while it's summed in.
3. Extract one small, pure, exported helper — e.g.
   `applyKickBassDuck(kickMono: Float32Array, bassMono: Float32Array, sr: number): Float32Array`
   (or reuse `computeDuckShapeParams`/`duckEnvelopeStep` from
   `src/core/audio/ducking.ts` if the shapes line up — check that file first,
   `EPIC-plan.md` says those were already extracted for the live Tone-graph
   duck and are unit-tested in `live-duck-envelope.test.ts`; reusing them
   instead of a 4th hand-rolled envelope is strictly better) — and call it
   identically from both `loadMixFromStems` and `renderRemixedWavBlob` so the
   two paths are provably the same DSP, not two independent hand-copies that
   drift (which is the entire reason this test exists).
4. Delete `src/core/audio/PreviewPlayer.ts.bak` and `PreviewPlayer.ts.bak40` —
   stray droppings from prior failed attempts at this exact file, not real
   source, pure clutter.

**Acceptance (hard gate, in this order — stop and report if step 1 fails):**
1. `npx tsc --noEmit` → 0 diagnostics.
2. `npm.cmd test -- --run src/test/live-mixer-preview.test.ts` → all tests in
   the file pass, including "gain changes Play buffer; matches
   renderRemixedWavBlob DSP within 16-bit tol" — not skipped, not loosened
   tolerance. If it still fails after the fix, that's new information to
   report, not a tolerance to widen.
3. `npm.cmd test -- --run` (full suite) → the other 18 files that are
   currently failing only because `PreviewPlayer.ts` doesn't parse should
   return to passing with **zero changes to those files**; if any of them
   fail for a *different* reason after this fix, report it, don't paper over.
4. Do not touch `helptip.test.ts`'s 2 failing HELP-key assertions — out of
   scope, different owner, different bug (see §0).

**Est. turns:** ~15-20. Single file, defects are already fully diagnosed above
with exact line numbers — this is implementation of a known fix, not
discovery.

### Brief B — verify + close out EPIC-plan.md's live-tweak parity claim

**Files:** `_cos-runs/EPIC-plan.md`, `docs/STATUS.md`. Code touch only if the
critic pass below finds a concrete, cited gap — cap at 1 file, revert to a new
brief instead of scope-creeping if it's bigger than that.

**Do (only after Brief A is merged and full suite + tsc are both green):**
1. Run `npx tsc --noEmit` for real and flip `EPIC-plan.md`'s last unchecked
   infra box (currently `[ ] npx tsc --noEmit — NOT VERIFIED: sandbox denies
   every invocation`) to `[x]` with the actual clean output noted, or leave it
   unchecked with the real error if it's still not clean — don't check a box
   you didn't verify (this project's own `CLAUDE.md`/prior-attempt lessons are
   explicit about this).
2. Run the `critic` subagent for the noob-journey pass `EPIC-plan.md` item 5
   already calls for and has never run (open→style→generate→play→tweak→
   rehear→export), specifically re-checking: (a) live Tone.Channel mute/solo/
   gain mid-play actually engages the master bus/compressor/limiter/duck
   claimed done in `EPIC-plan.md`'s checklist — verify by reading
   `loadLiveFromStems`/`teardownLiveGraph`, not by re-trusting the checklist;
   (b) Brief A's fix didn't regress `loadMixFromStems`'s "Play still hears the
   remixed native buffer" assertion or the mute-kick energy-delta assertion in
   `live-mixer-preview.test.ts`.
3. Fix only concrete, cited gaps the critic surfaces — no speculative scope
   add. Update `EPIC-plan.md`'s checkboxes and `docs/STATUS.md` to match
   verified reality.

**Acceptance:** `npx tsc --noEmit` green (re-confirmed after any critic-driven
fix), `npm.cmd test -- --run` green, `EPIC-plan.md` checkboxes all reflect
something actually re-verified this session (not carried over from before).

**Est. turns:** ~15-20 (critic subagent call + doc updates + at most one small
fix).

## 3. `live-mixer-preview` gain-DSP flake: real bug or test tolerance?

**Real product bug, not test tolerance.** Confirmed by reading both DSP paths
end to end (see §2, items 1-2): `renderRemixedWavBlob`'s duck computation is
dead code that never reaches the returned buffer, while `loadMixFromStems`'s
duck is applied but derived from/applied to the wrong signal (the whole mixed
bus self-referencing as both "kick" and "bass"). Two DSP paths that are each
wrong in different ways will not agree within 16-bit tolerance at any
threshold — widening the tolerance would hide a real, audible correctness bug
(the "must slap" bar this whole epic exists for), so **do not** touch the
`0.01` tolerance in the test. Fix recipe is Brief A above; no WONTFIX case
applies here — this is fixable and worth fixing.

## 4. Next north-star P0 after HelpTips land

Ranking, given (a) `EPIC-plan.md`'s live-tweak-parity epic will be fully
closed once Briefs A+B land, and (b) `docs/critic-audio-must-fixes-cycle-4.md`
already has a scoped, un-actioned P1 list from an earlier audit cycle:

1. **P1.1 — Export ZIP byte integrity** (`docs/critic-audio-must-fixes-cycle-4.md:136`).
   Cheapest real correctness gap on the books: `zip.test.ts` only checks `PK`
   magic bytes, never a CRC round-trip of stem bytes vs. source blobs. A
   corrupt-but-PK-prefixed ZIP currently passes the suite. This is a small,
   mechanical, high-confidence fix (add CRC32 verification to the existing
   test + confirm the zip writer computes it correctly) with no design
   ambiguity — good next FCC brief once P0-3 closes.
2. **P1.3 — Seed reproducibility of audio, not just StructureMap**
   (same doc, line 156). `CLAUDE.md`-equivalent principle #3 in the Metal
   project ("reproducibility... given a seed, regenerating must produce
   identical output") applies here too, and today only the StructureMap JSON
   is asserted identical for a fixed seed — the actual audio bytes aren't.
   This is the kind of gap that silently rots ("looks tested, isn't") if left
   past this cycle.
3. **P1.2 / P0's loudness-honesty flag** — `truePeakDbTP` is filled with
   sample-peak, not true-peak, and only warns in `warnings[]` (line 24, 60).
   Worth a rename-and-be-honest pass (`samplePeakDbFS` + explicit
   `peakMetric` field) before any UI ever surfaces that number to a user as
   if it were broadcast-standard true-peak.

P1.4 (style-ref bias depth), P1.5 (dead Power BPM control), and the P2 list
are real but lower urgency than these three — none of them are "the mix
silently lies to the user" or "a signed contract (reproducibility, integrity)
is unenforced," which is the bar the top 3 clear and the rest don't.

## Verify (this session, honest)

- `npx tsc --noEmit`: **RED**, 9 diagnostics, all `PreviewPlayer.ts` (listed in
  §0). Not fixed here — file is read-only per this brief's scope; exact fix is
  Brief A above. Not claiming green.
- `npm.cmd test -- --run`: **18/38 passed, 20 failed** (19 of those are the
  same root cause as the tsc failure — see §0 — 1 is FCC's separate mid-flight
  HelpTips work, out of scope here).
- No `src/` files edited this session. Only `_cos-runs/PAID-P0-3-THIN.md`
  (this file) written.
