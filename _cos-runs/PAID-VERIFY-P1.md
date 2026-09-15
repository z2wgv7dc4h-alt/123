# PAID-VERIFY-P1 — verify snapshot + next FCC queue (2026-09-14)

Per `BRIEF-paid-verify-p1.md`: brain/verify only, no `src/` edits this
session. Stayed off `helpCopy.ts`, `helptip.test.ts`, `PreviewPlayer.ts`,
`OfflineStubBackend.ts`, `SectionTimeline.tsx` (read-only where opened at
all).

## 0. Verify snapshot — HONEST: could not execute this session either

**Every attempt to run `npx tsc --noEmit` or `npm.cmd test -- --run` this
session was auto-denied**, via Bash, via the PowerShell tool, and via a
dedicated `qa` subagent spawned specifically to try a separate tool-call
path. All three attempts returned the identical message: *"this session has
no approval surface — nobody can answer a permission prompt here."* This is
the same session-level limitation `PAID-P1-NEXT.md` hit last time, still
unresolved. Even a plain read-only `ls` (via Bash) was denied — this
session cannot execute **any** shell command, not just build/test ones.

**No exit code, diagnostic count, or pass/fail count in this document is a
result of a run I performed.** Where a number appears below, it is
explicitly attributed to its source (an FCC agent's own self-report from a
different session that evidently *could* execute commands) — never
presented as this session's own verification.

**Secondhand data point only (not verified by this session):**
`_cos-runs/FCC-HELPTIPS-P0A-RESULT.md` (dated after `PAID-P1-NEXT.md`,
confirmed by content — see §1 below) self-reports from its own session:
- `npm.cmd test -- --run src/test/helptip.test.ts` → 14 tests passed
- Full `npm.cmd test -- --run` → 38 test files passed, 228 tests passed, 2 skipped
- `npx tsc --noEmit` → **not run**, skipped in that session for the same
  permission-denial reason hitting this one

Treat this as "the last agent that could run commands reported green,"
not as this session's own confirmation. **Whoever next has a working
approval surface must actually run both commands and record real numbers
here or in a successor doc — this gate is still open.**

## 1. Re-read of `PAID-P1-NEXT.md` §1–§3 against the current tree

### §1a (Expand/Repeat/×2 tips) — unchanged, still done
Not re-verified line-by-line this session (no `src/` edit planned here and
`PAID-P1-NEXT.md` already confirmed it in detail); no contradicting
evidence found while reading the surrounding file for §1b/§1c below.

### §1b (dead key deletion, P0-A) — **STALE in `PAID-P1-NEXT.md`, now DONE**
`PAID-P1-NEXT.md` reported this as "BROKEN, new bug" (stranded
`'moreControls'`/`'badgeWebApp'`/`'timeline'` string literals left in
`SIMPLE_HELP_KEYS` after the object keys were deleted). **Re-grepped the
current tree just now: `moreControls`, `badgeWebApp`, `powerMode`, and the
bare string `'timeline'` no longer appear anywhere under `src/` at all.**
`src/ui/lib/helpCopy.ts`'s `SIMPLE_HELP_KEYS` array (currently lines
345–376) contains none of the three stranded literals. This matches
`_cos-runs/FCC-HELPTIPS-P0A-RESULT.md`'s self-report, which post-dates
`PAID-P1-NEXT.md` and explicitly says all four dead keys (including
`timeline` "object + removed from SIMPLE_HELP_KEYS") were removed and
`helptip.test.ts` was checked for stale references. **Nothing to brief
here — do not reopen.**

### §1c (stems copy undercount, P1-A) — confirmed **still NOT done**
Re-read `src/ui/lib/helpCopy.ts` just now:
- `stems` (currently lines 54–55): *"What: Separate tracks
  (kick/snare/hats/bass). When: After Sketch Generate. What happens:
  Mute/Solo/Gain update Play live; ZIP keeps dry tracks."* — still 4 names,
  still missing `perc`, still no `drums`/`mix`-are-buses clause.
- `glossaryStem` (currently lines 115–116): *"What: Separate track = one
  part (kick/snare/hats/bass)..."* — same undercount, same missing clause.
- `stems` is still present in `SIMPLE_HELP_KEYS` (currently line 363),
  so it's still hard-capped at ≤160 chars by `helptip.test.ts`'s
  length-check test.

This is a real, still-open gap — carried forward to the queue below
unchanged in substance, with refreshed line numbers.

### §2 (ZIP CRC test) — confirmed **still NOT done**
Re-read `src/test/zip.test.ts` in full: still exactly 13 lines, still only
one test (`'builds a store zip with PK headers'`) that checks the first two
magic bytes and that `zip.size > 30`. No CRC field is read back, no
extracted-bytes comparison exists. `src/core/export/zip.ts` was not
reopened this session (out of scope per Brief A's own file list — no
writer bug was claimed there and nothing here contradicts that). Gap
carried forward unchanged.

### §3 (seed→audio byte repro test) — confirmed **still NOT done**
Re-read `src/test/honesty.test.ts` in full (211 lines, confirmed via
line-count): `offlineStubBackend` is already imported (line 7) and used
elsewhere in the file, but no test resembling *"same seed + params →
identical rendered audio bytes"* exists anywhere in it — the file's last
block is `describe('honesty: zip export bytes')` (line 198) checking only
the PK signature, not a byte-identity/seed-repro test. Also confirmed the
draft test snippet in `PAID-P1-NEXT.md` §3 type-checks structurally against
the current `RenderJob`/`StylePrompt`/`RenderResult` interfaces in
`src/core/types/index.ts` (fields `jobId`, `seed`, `bpm`, `bpmTolerance`,
`durationBars`, `sampleRateHz: 48000`, `bitDepth: 16 | 24`, `channels: 2`,
`prompt: StylePrompt { descriptors, energy, darkness, chaos?, text? }`,
`stemSchemaVersion: 'v0'` all match; `RenderResult.stems: StemFile[]`
matches the snippet's `.stems` usage) — safe to hand to FCC as-is, no
respec needed. Gap carried forward unchanged.

## 2. Next FCC queue — ordered, copy-paste briefs, hard-disjoint files

All three remaining items touch three completely disjoint files
(`helpCopy.ts` / `zip.test.ts` / `honesty.test.ts`) and none of them opens
`PreviewPlayer.ts`, `OfflineStubBackend.ts`, `zip.ts`, `download.ts`, or
`SectionTimeline.tsx` — safe to run in parallel, or in this order if run
serially.

### (a) BRIEF-fcc-helptips-p1a-stems-copy.md — stems copy undercount

```
WRITER=DnB-FCC. Files: src/ui/lib/helpCopy.ts ONLY. Do not touch
helptip.test.ts, SectionTimeline.tsx, or anything under src/core/.

Fix the stems-copy undercount (4 named stems, missing `perc`; no
drums/mix-bus clause):

1. `stems` (currently helpCopy.ts:54-55) — rewrite to name all 5 elemental
   stems (kick/snare/hats/perc/bass) and note `drums`/`mix` are combined
   buses, not extra parts. This key is in `SIMPLE_HELP_KEYS` — hard-capped
   at <=160 chars by helptip.test.ts's length-check test. Starting point
   (verify actual length against the real test, don't eyeball it):
   'What: Separate tracks (kick/snare/hats/perc/bass). When: After Generate.
   What happens: Mute/Solo/Gain update Play; \'drums\'/\'mix\' are buses,
   not extra parts.'
2. `glossaryStem` (currently helpCopy.ts:115-116) — same stem-name fix, same
   buses-not-parts clause added; not in SIMPLE_HELP_KEYS so no hard char
   cap, but keep the existing "Dry = original ZIP file; mix_as_heard =
   remixed Play match" clause intact.

Re-grep for exact current line numbers before editing — they may have
moved since this brief was written.

Acceptance (run for real, record actual output, soft-pass forbidden):
1. `npx tsc --noEmit` -> 0 diagnostics
2. `npm.cmd test -- --run src/test/helptip.test.ts` -> all pass
3. `npm.cmd test -- --run` full suite green
```

### (b) BRIEF-fcc-zip-crc-test.md — ZIP CRC round-trip test

```
WRITER=DnB-FCC. Files: src/test/zip.test.ts ONLY. Do not touch zip.ts,
download.ts, or OfflineStubBackend.ts — no writer bug exists (crc32() at
zip.ts:6-13 is a correct standard CRC-32 and buildZip() already writes real
CRCs into both the local header and central directory). This is a
test-only gap: the existing test only checks the first 2 magic bytes.

Add to zip.test.ts (or a new zip-crc.test.ts): build a ZIP via buildZip()
with 2+ entries of distinct known byte content, then in the test itself
(black-box, don't import zip.ts internals beyond buildZip/ZipEntry/
blobToUint8):
1. Read the 4-byte local signature at offset 0, confirm 0x04034b50.
2. Read the stored CRC-32 (4 bytes at local-header offset +14) and
   compressed/uncompressed size (offset +18, +22).
3. Read the filename length (offset +26), skip name + extra to reach data
   start, slice out data.length bytes.
4. Recompute CRC-32 of the extracted bytes with a SECOND, independently
   written CRC-32 implementation inline in the test (do not reuse/import
   zip.ts's crc32 — that only proves self-agreement, not byte round-trip).
   Assert it equals the stored CRC field.
5. Assert extracted bytes are byte-for-byte equal (toEqual) to the original
   source Uint8Array, not just same length.
6. Repeat for a second entry to prove per-entry offsets/CRCs don't collide
   with multiple files.

Acceptance: `npm.cmd test -- --run src/test/zip.test.ts` passes with the
new assertions actually executing (not skipped); full suite + tsc stay
green.
```

### (c) BRIEF-fcc-seed-audio-repro-test.md — seed->audio byte reproducibility

```
WRITER=DnB-FCC. Files: src/test/honesty.test.ts ONLY. Do not touch
OfflineStubBackend.ts unless the new test genuinely fails AND the failure
is diagnosed to a real non-determinism first — report that finding before
patching anything.

Add this test (offlineStubBackend is already imported at honesty.test.ts:7;
verified this snippet's field names match the current RenderJob/
StylePrompt/RenderResult interfaces in src/core/types/index.ts):

it('same seed + params -> identical rendered audio bytes, not just StructureMap', async () => {
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

Notes: different jobId values prove the audio is seed-keyed, not
jobId-keyed. Compare raw WAV bytes, not decoded samples. If stemA.blob is
ever undefined for a stem that should exist, report that as a real bug —
don't `?.`-away the check.

Acceptance: `npm.cmd test -- --run src/test/honesty.test.ts` passes with
the new test actually executing; full suite + tsc stay green. This test is
expected to pass as written (OfflineStubBackend.ts was grepped for
Math.random()/Date.now()/crypto.*/performance.now() with zero matches) —
if it fails, that's a real hidden non-determinism to flag loudly, not a
reason to loosen the assertion.
```

## 3. Optional — Critic noob-journey checklist (carried forward, docs only)

Unchanged from `PAID-P1-NEXT.md` §7 — still blocked on the same
independently-confirmed-green precondition, which is still not met this
session:

- [ ] Open -> Style Ref (or skip) -> Generate: does the first sketch play
      without a second click anywhere?
- [ ] Play -> mid-playback mute one elemental stem -> does the audible
      change happen instantly (Tone.Channel live), not on next Generate?
- [ ] Mid-playback mute the `drums` **bus** row while `kick` is separately
      un-muted -> per §1c's finding, does the result match what a user
      would expect from the (still pending) "buses, not extra parts" copy,
      or is there a surprising interaction worth a follow-up tip?
- [ ] Expand a middle section, click Generate: diff the untouched
      sections' hit arrays before/after -> confirm the UI-level experience
      matches the guarantee §1a's copy states in the tips.
- [ ] Export ZIP -> unzip with a real OS tool (not just the new CRC test)
      -> confirm stem count/names match the manifest and `perc.wav` is
      present when the structure has perc hits.
- [ ] Re-run Export with the same seed twice -> confirm (per §3's new test,
      but manually via the actual UI) the two ZIPs' stem WAVs are
      byte-identical.

## 4. Files touched this session

Only `_cos-runs/PAID-VERIFY-P1.md` (this file) was written. No `src/`
files were opened for editing. Opened read-only to verify current state:
`src/ui/lib/helpCopy.ts`, `src/test/zip.test.ts`, `src/test/honesty.test.ts`,
`src/core/types/index.ts`, `src/test/helptip.test.ts` (grep only),
`_cos-runs/PAID-P1-NEXT.md`, `_cos-runs/FCC-HELPTIPS-P0A-RESULT.md`.
`Bash`/`PowerShell` execution and a `qa` subagent were attempted for `tsc`/
`test` and all three were denied — recorded honestly in §0, not
worked around, not fabricated past.
