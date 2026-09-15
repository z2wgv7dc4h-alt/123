# PAID-P1-NEXT — HelpTips leftovers + P1.1/P1.3 FCC briefs (2026-09-14)

Per `BRIEF-paid-brain-p1-next.md`: brain only, docs, no `src/` edits this
session. `PreviewPlayer.ts` was **read but not edited** (FCC-owns it this
turn per `BRIEF-fcc-p03-duck-a.md`). `helpCopy.ts` / `SectionTimeline.tsx` /
`helptip.test.ts` / `zip.ts` / `zip.test.ts` / `honesty.test.ts` /
`OfflineStubBackend.ts` were opened for **reading only** — every claim below
is from re-reading the current tree just now, not from trusting an earlier
doc's snapshot.

## 0. Verify — could not run this session (honest, not a soft-pass)

Every attempt to run `npx tsc --noEmit` or `npm.cmd test -- --run` this
session — via Bash, via PowerShell, via the `qa` subagent — was auto-denied
with: *"this session has no approval surface — nobody can answer a
permission prompt here."* This is a session-level tooling limitation, not a
choice to skip verification. **No exit code, diagnostic count, or pass/fail
count below is fabricated** — where I state something about build/test
state, it is inferred from static reading of the source (called out
explicitly as "read, not run" each time), never presented as a live run
result. The FCC briefs below each carry their own hard verify gate that
*can* run in a normal session — do not treat anything in this doc as a
substitute for that.

## 1. FCC GRUNT brief — HelpTips leftovers (dead keys / stems copy)

**Status: NOT done, partially regressed since `PAID-NEXT-BRAIN.md`.** Three
sub-items from that doc's original 3-item list:

### 1a. Expand/Repeat/×2 per-button tips (P0-B) — **DONE, verified**
`helpCopy.ts:68-73` has `expandSection`/`repeatSection`/`dropX2` keys, each
stating "Only this section changes; same seed; rest of song stays."
`SectionTimeline.tsx:249,263,277` wire them onto the three buttons
respectively (the other 3 `HELP.sectionTimeline` uses at `:160,183,196` are
untouched, correctly still generic). Both are in `SIMPLE_HELP_KEYS`
(`helpCopy.ts:431-433`) and in `helptip.test.ts`'s P0-wire-targets list
(`:101-103`). Nothing to do here — do not re-open this sub-item.

### 1b. Dead key deletion (P0-A) — **BROKEN, new bug, not just incomplete**
The 4 `HELP.*` object entries (`powerMode`, `moreControls`, `badgeWebApp`,
`timeline`) were correctly deleted from the `HELP` object itself (grepped
the whole file, confirmed absent as object keys), and `helptip.test.ts` was
correctly cleaned (no references to any of the 4 remain). **But
`SIMPLE_HELP_KEYS` in `helpCopy.ts` still lists 3 of them as string literals:
`'moreControls'` (currently line 356), `'badgeWebApp'` (line 359), and
`'timeline'` (line 372).** `SIMPLE_HELP_KEYS` is typed
`as const satisfies readonly HelpKey[]` and `HelpKey = keyof typeof HELP`
(`helpCopy.ts:278`) — since these 3 strings are no longer keys of `HELP`,
this does not type-check. This is a live regression: whoever did the P0-A
deletion removed the object entries and the test-file references but missed
the `SIMPLE_HELP_KEYS` array — the exact "left both, didn't finish the
delete" shape. (`powerMode` itself is fully gone, including from this array —
only these 3 remain stranded.)

**Fix:** delete the `'moreControls'`, `'badgeWebApp'`, `'timeline'` lines
from `SIMPLE_HELP_KEYS` in `helpCopy.ts`. Re-grep for the exact line numbers
before editing — line numbers above are as of this read and may have moved.

### 1c. Stems copy undercount (P1-A) — **NOT done**
`helpCopy.ts:54-55` (`stems`) and `:115-116` (`glossaryStem`) both still say
*"Separate tracks (kick/snare/hats/bass)"* — 4 names, missing `perc` (a real
elemental stem, confirmed still present today: `useStudioStore.ts`'s
`ELEMENTAL_STEM_IDS` is 5 items, and `OfflineStubBackend.ts:850-852` still
conditionally emits a `perc` `StemFile` when the structure has perc hits).
Neither tip mentions that `StemMixer.tsx`'s grid also has `drums`/`mix` bus
rows with the identical Mute/Solo controls.

**Fix:** rewrite both to name all 5 elementals and call out `drums`/`mix` as
combined buses. `stems` is in `SIMPLE_HELP_KEYS` (`helpCopy.ts:365`) so it is
hard-capped at ≤160 chars by `helptip.test.ts:121-125` — **draft below is a
starting point, not guaranteed to fit; verify length against the actual test,
don't eyeball it**:

```
stems:
  'What: Separate tracks (kick/snare/hats/perc/bass). When: After Generate. What happens: Mute/Solo/Gain update Play; \'drums\'/\'mix\' are buses, not extra parts.',
```

`glossaryStem` is not in `SIMPLE_HELP_KEYS` (no hard cap) — same content
direction, keep the existing "Dry = original ZIP file; mix_as_heard =
remixed Play match" clause, just fix the stem-name list and add a
buses-not-parts clause.

**Files:** `src/ui/lib/helpCopy.ts` only for 1b/1c.

**Acceptance:**
1. `npx tsc --noEmit` → 0 diagnostics (this alone should fix whatever
   `SIMPLE_HELP_KEYS`-shaped error 1b is currently causing).
2. `npm.cmd test -- --run src/test/helptip.test.ts` → all pass, including
   the ≤160-char test for `stems`.
3. `npm.cmd test -- --run` full suite green.

## 2. FCC GRUNT brief — P1.1 Export ZIP CRC integrity (test-only, no writer bug found)

**Re-scoped from `docs/critic-audio-must-fixes-cycle-4.md:136-146`: that doc
is partly stale.** Read `src/core/export/zip.ts` end to end just now:
- `crc32()` (`zip.ts:6-13`) is a correct, standard CRC-32 (poly `0xEDB88320`,
  init `~0`, final `~c >>> 0`), and `buildZip()` already writes the real CRC
  of each entry's bytes into **both** the local file header (`zip.ts:64`)
  and the central directory record (`zip.ts:80`). **No writer bug exists
  today** — the cycle-4 doc's "test + writer fix" framing overstates it; it's
  test-only.
- The cycle-4 doc's other two P1.1 gaps are also already resolved, contrary
  to its text: `OfflineStubBackend.ts:850-852` **does** export a `perc.wav`
  StemFile when the structure has perc hits (not "no perc StemId/WAV"), and
  the drums-bus formula **is** documented in a manifest warning
  (`OfflineStubBackend.ts:891`: `'drums bus = 0.85 * (kick + snare + hats +
  perc); not equal to summing exported elementals alone'`). Don't re-do
  either of those.
- The one real gap: `src/test/zip.test.ts` (13 lines total) only asserts the
  first 2 bytes are `PK` — it never reads back a CRC field or compares
  extracted bytes to source. A ZIP with a corrupted data section but intact
  `PK\x03\x04` magic would still pass today.

**Fix — add to `src/test/zip.test.ts` (or a new `zip-crc.test.ts`):** build a
ZIP via `buildZip()` with 2+ entries of distinct known byte content, then
write a small **local-file-header parser inline in the test** (don't import
internals from `zip.ts` — it exports nothing but `buildZip`/`ZipEntry`/
`blobToUint8`, keep the test black-box):
1. Read the 4-byte local signature at offset 0, confirm `0x04034b50`.
2. Read the stored CRC-32 (4 bytes at local-header offset +14) and
   compressed/uncompressed size (offset +18, +22).
3. Read the filename length (offset +26) and skip name + extra to reach the
   data start; slice out `data.length` bytes.
4. Recompute CRC-32 of the extracted bytes with a **second, independently
   written** CRC-32 implementation in the test (don't reuse/import
   `zip.ts`'s `crc32` — that would only prove the function agrees with
   itself, not that the bytes round-trip) and assert it equals the stored
   CRC field.
5. Assert the extracted bytes are byte-for-byte equal (`toEqual`) to the
   original source `Uint8Array`, not just same length.
6. Repeat for a second entry to prove per-entry offsets/CRCs don't collide
   when there are multiple files.

**Files:** `src/test/zip.test.ts` only. Do not touch `zip.ts`,
`download.ts`, or `OfflineStubBackend.ts` — no writer change is needed per
the reading above; if the new test somehow fails, that's new information to
report, not a license to also patch the writer in the same brief.

**Acceptance:** `npm.cmd test -- --run src/test/zip.test.ts` passes with the
new CRC-round-trip assertions actually executing (not skipped); full suite
+ `tsc` stay green.

## 3. FCC GRUNT brief — P1.3 seed→audio reproducibility (test-only, no src fix expected)

**Verified today: `OfflineStubBackend.ts` has zero unseeded randomness** —
grepped the whole file for `Math.random()`, `Date.now()`, `crypto.*`,
`performance.now()`: no matches. Everything downstream of
`structureEngine.plan()` (already proven deterministic per seed by
`honesty.test.ts:12-27`) appears to be pure DSP driven off the structure +
job params. This means the missing test below is expected to **pass as
written, with no `OfflineStubBackend.ts` change needed** — flag it loudly in
the FCC run's report if it doesn't, since that would mean an actual hidden
non-determinism this reading missed, not a reason to loosen the assertion.

**Fix — add to `src/test/honesty.test.ts`** (extends the existing `describe('honesty: structure seed + version')` block, or a new adjacent `describe`):

```ts
it('same seed + params → identical rendered audio bytes, not just StructureMap', async () => {
  const job = {
    jobId: 'repro_a',
    seed: 4242,
    bpm: 174,
    bpmTolerance: 2,
    durationBars: 16,
    sampleRateHz: 48000,
    bitDepth: 16 as const,
    channels: 2 as const,
    prompt: { descriptors: ['test'], energy: 0.6, darkness: 0.5 },
    stemSchemaVersion: 'v0' as const,
  };
  const a = await offlineStubBackend.render({ ...job, jobId: 'repro_a' });
  const b = await offlineStubBackend.render({ ...job, jobId: 'repro_b' });
  expect(a.stems.length).toBe(b.stems.length);
  for (const stemA of a.stems) {
    const stemB = b.stems.find((s) => s.id === stemA.id)!;
    expect(stemB).toBeTruthy();
    const bytesA = new Uint8Array(await stemA.blob!.arrayBuffer());
    const bytesB = new Uint8Array(await stemB.blob!.arrayBuffer());
    expect(bytesA).toEqual(bytesB);
  }
});
```

Notes for whoever implements this:
- Use different `jobId` values (as above) to prove the *audio* is seed-keyed,
  not job-id-keyed — if that field leaks into any filename/salt this would
  catch it.
- Compare raw WAV bytes, not decoded samples — the whole point is byte-exact
  reproducibility of the exported artifact, matching how `PAID-P1-NEXT.md`'s
  brief and this project's `CLAUDE.md`-equivalent reproducibility principle
  are framed ("given a seed, regenerating a section must produce identical
  output").
- If `stemA.blob` is ever undefined for a stem that should exist, that's a
  real bug to report, not something to `?.`-away — every `usable`/`wanted`
  stem should have a blob per current `bufferToStem` usage.

**Files:** `src/test/honesty.test.ts` only. Do not touch
`OfflineStubBackend.ts` unless the new test actually fails and the failure
is diagnosed to a real non-determinism — report that finding first before
patching.

**Acceptance:** `npm.cmd test -- --run src/test/honesty.test.ts` passes
with the new test actually executing; full suite + `tsc` stay green.

## 4. P1.2 true-peak honesty — design note, already resolved as "rename," nothing to brief

Checked `src/core/types/index.ts:191-213` and
`OfflineStubBackend.ts:542-545`: the rename-and-be-honest pass
`PAID-P0-3-THIN.md §4` flagged as still-needed **has already landed**.
`StemFile` has `samplePeakDbFS` (honest name) and `peakMetric:
'sample-peak'` as the primary fields; `truePeakDbTP` is explicitly
`@deprecated` in its doc-comment and dual-written from the same sample-peak
measurement for back-compat, not presented as real inter-sample true-peak.
`OfflineStubBackend.ts` sets all three consistently
(`samplePeakDbFS: peakDb`, `peakMetric: 'sample-peak'`,
`truePeakDbTP: peakDb`). **No FCC brief needed for P1.2** — it's done, not a
design decision still pending. If a future UI surfaces `truePeakDbTP` to a
user as if it were broadcast-standard true-peak, that would be a new,
different bug (a UI-copy one), not this one.

## 5. Bonus finding (not requested, flagging only) — dead duplicate summing loop in `renderRemixedWavBlob`

Not part of this brief's ask, and **not owned by this session** (PreviewPlayer.ts
is FCC's file this turn) — noting for whoever next touches that file, not
proposing a brief for it now. Reading `PreviewPlayer.ts` (read-only, per this
session's scope): `renderRemixedWavBlob` now builds **two** summed buffers —
a `channels[]` array (loop ~L922-941, using the correctly-computed
`duckAppliedBass`) that is never read again anywhere in that function, and a
second `mixedChannels[]` array (loop ~L944-965, identical logic) that *is*
what actually flows into the returned blob. This is not a correctness bug —
the live path (`mixedChannels`) does apply the duck fix correctly — but it's
the same "compute it twice, only one wired in" shape `PAID-P0-3-THIN.md §1`
already found once in this exact function, resurfacing after that fix as
wasted computation instead of a compile error. Cheap follow-up whenever
`PreviewPlayer.ts` next opens: delete the `channels` array and its loop,
feed `duckAppliedBass` straight into the `mixedChannels` loop. Also still
outstanding from Brief A item 4: `src/core/audio/PreviewPlayer.ts.bak` and
`PreviewPlayer.ts.bak40` still exist on disk (confirmed via glob today) —
stray droppings, not deleted yet.

## 6. Hard disjoint file ownership (so next FCC + paid can run in parallel)

| Track | Owns (write) | Must not open |
|---|---|---|
| FCC — HelpTips (§1) | `src/ui/lib/helpCopy.ts` | `SectionTimeline.tsx` (already correctly wired, no change needed), `PreviewPlayer.ts`, anything under `src/core/audio/` |
| FCC — ZIP CRC (§2) | `src/test/zip.test.ts` | `src/core/export/zip.ts`, `download.ts` (no writer bug — don't touch) |
| FCC — seed audio repro (§3) | `src/test/honesty.test.ts` | `src/core/backends/OfflineStubBackend.ts` (no fix expected — don't touch unless the new test genuinely fails and the cause is diagnosed first) |
| FCC/paid — PreviewPlayer cleanup (§5, optional, later) | `src/core/audio/PreviewPlayer.ts` (+ delete the two `.bak*` files) | everything above |

§1/§2/§3 touch three completely disjoint files
(`helpCopy.ts` / `zip.test.ts` / `honesty.test.ts`) — safe to run as three
parallel FCC briefs with zero collision risk. None of the three opens
`PreviewPlayer.ts`, `OfflineStubBackend.ts`, `ducking.ts`, or
`SectionTimeline.tsx`.

## 7. Optional — noob-journey checklist for after Brief A is confirmed green (doc only)

For whichever agent runs the critic pass once `tsc`/full suite are
independently confirmed green in a session that *can* execute commands:

- [ ] Open → Style Ref (or skip) → Generate: does the first sketch play
      without a second click anywhere?
- [ ] Play → mid-playback mute one elemental stem → does the audible change
      happen instantly (Tone.Channel live), not on next Generate?
- [ ] Mid-playback mute the `drums` **bus** row while `kick` is separately
      un-muted — per §1c's finding, does the result match what a user would
      expect from the (now-fixed) "buses, not extra parts" copy, or is there
      still a surprising interaction worth a follow-up tip?
- [ ] Expand a middle section, click Generate: diff the untouched sections'
      hit arrays before/after (per `structure-expand.test.ts` /
      `listen-expand.test.ts` pattern) — confirm the UI-level experience
      matches the guarantee §1a's copy now states in the tips.
- [ ] Export ZIP → unzip with a real OS tool (not just the new CRC test) →
      confirm stem count/names match the manifest and `perc.wav` is present
      when the structure has perc hits.
- [ ] Re-run Export with the same seed twice → confirm (per §3's new test,
      but manually via the actual UI this time) the two ZIPs' stem WAVs are
      byte-identical.

## 8. Files touched this session

Only `_cos-runs/PAID-P1-NEXT.md` (this file) was written. No `src/` files
were opened for editing; `helpCopy.ts`, `SectionTimeline.tsx`,
`helptip.test.ts`, `zip.ts`, `zip.test.ts`, `honesty.test.ts`,
`OfflineStubBackend.ts`, `PreviewPlayer.ts`, `types/index.ts`, and
`download.ts` were opened **read-only** to verify the claims above against
the current tree, not against memory of prior docs.
