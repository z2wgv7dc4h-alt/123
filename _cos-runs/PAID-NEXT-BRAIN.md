# PAID-NEXT-BRAIN — adversarial pass on disjoint areas (2026-09-14)

Scope per `BRIEF-paid-brain-next.md`: HelpTips teach quality, player-length
readability, live mute/solo/gain **UX honesty** (UI + store only), Expand/
Vary/seed copy vs the CLAUDE bar. Did **not** touch `PreviewPlayer.ts`,
`OfflineStubBackend.ts`, or `ducking.ts` — FCC owns those (P0-3) and they were
never opened this session. No `src/` files were edited; every claim below was
verified by reading the current tree, not by memory of prior docs.

## P0 — real gaps

### P0-A. Four `HELP.*` keys are dead — defined, tested for structure, never rendered
- `src/ui/lib/helpCopy.ts:30` (`powerMode`), `:36` (`moreControls`), `:42`
  (`badgeWebApp`), `:74` (`timeline`) — grepped every `.tsx`/`.ts` under
  `src/` for `HELP.powerMode`, `HELP.moreControls`, `HELP.badgeWebApp`,
  `HELP.timeline`: zero component render sites for any of the four.
  `moreControls` and `badgeWebApp` are referenced only inside
  `src/test/helptip.test.ts:54,101` (the "covers P0 wire targets" list, which
  only asserts length/no-banned-phrase — it doesn't assert the key is ever
  shown to a user). `powerMode` and `timeline` aren't referenced anywhere
  outside `helpCopy.ts` itself, including tests.
- `timeline` is a known, previously-flagged duplicate: `docs/ux-must-fixes-helptip-teach.md:33`
  explicitly called for merging `sectionTimeline`/`timeline` into one key.
  That merge happened in practice (`sectionTimeline` is the one actually
  wired, 6 call sites in `SectionTimeline.tsx`) but the doc's own
  instruction to delete the loser was never carried out — `timeline` is
  strictly dead weight left behind by an incomplete refactor, the exact
  "left both, didn't merge/delete" pattern CLAUDE.md's lessons-learned
  section warns about (that lesson is scoped to the Metal project's
  CLAUDE.md, but the failure shape is identical here).
- A tip nobody can open teaches nobody anything; these are pure maintenance
  debt masquerading as coverage (they pass every HELP-catalog test because
  those tests iterate `Object.keys(HELP)` / a hardcoded list, never actual
  render call sites).
- **Fix (tiny, mechanical):** delete the 4 keys from `helpCopy.ts` (object
  entries + the 3 that also appear in `SIMPLE_HELP_KEYS` at `:358,361`;
  `powerMode`/`timeline` aren't in that array) and drop them from
  `helptip.test.ts:43-103`'s key list. Re-run `helptip.test.ts` after — it
  should still pass since nothing else references these keys.

### P0-B. Expand / Repeat / ×2 HelpTips all show the same generic body text — none state the one guarantee the product bar cares about
- `src/ui/components/SectionTimeline.tsx:239-250` (Expand button),
  `:252-265` (Repeat button), `:266-279` (×2 button): all three attach
  `<HelpTip text={HELP.sectionTimeline} ...>` — literally the same string
  (`helpCopy.ts:72-73`, the generic "Song map (intro → drop)... Drag an edge
  or Expand/Repeat/×2, then Generate again" blurb) — while giving each tip a
  *distinct* `ariaLabel` ("About Expand", "About Repeat", "About double
  drop"). A screen-reader user or anyone reading the aria-label gets a
  specific promise; the actual tip body never delivers on it.
- More importantly: none of the three tips, and none of the buttons' native
  `title=` strings (`:243,257,272` — "Expand +8 bars — arrangement applies
  on next Generate" etc.), ever say the thing CLAUDE.md's product bar names
  as non-negotiable: *"Expand/×2 a section then Generate MUST keep the SAME
  seed and song; only stretch/repaint that section."* `PAID-P0-1-RESULT.md`
  confirms the engine now actually honors this (per-section RNG landed,
  verified by `structure-expand.test.ts`/`listen-expand.test.ts` diffing
  unedited-section hit arrays) — but a user has zero way to learn that
  guarantee exists from the UI. They see "arrangement applies on next
  Generate" and have no reason to trust Expand won't scramble the rest of
  the song, even though it provably won't anymore.
- **Fix:** give Expand/Repeat/×2 their own `HELP.*` keys (e.g.
  `expandSection`, `repeatSection`, `dropX2`) instead of sharing
  `sectionTimeline`, each stating the guarantee plainly, e.g.: *"What:
  Stretch this section by 8 bars. When: Click Expand, then Generate. What
  happens: Only this section's drums/bass change — same seed, rest of the
  song stays exactly as it was."* Add to `SIMPLE_HELP_KEYS` (Expand/Repeat/
  ×2 are reachable from Simple's `SectionTimeline`, `App.tsx:143`).

## P1 — real, worth doing, not table-stakes

### P1-A. Stem mixer's own teaching copy undercounts its own rows
- `src/ui/hooks/useStudioStore.ts:46` — `ELEMENTAL_STEM_IDS` is 5 items:
  `kick, snare, hats, perc, bass`.
- `src/ui/components/StemMixer.tsx:12` — the full mixer grid (`ROWS`) has 8
  rows: the 5 elemental + `other` (conditional) + two **bus** rows, `drums`
  and `mix`, each with the identical Mute/Solo controls and identical
  `HELP.stemMute`/`HELP.stemSolo` copy as every elemental row (`:104-121`,
  `:66,71` for the shared legend tips).
- `helpCopy.ts:60-61` (`stems`) and `:117-118` (`glossaryStem`) — the two
  tips whose entire job is to teach "what is a stem here" both say
  *"Separate tracks (kick/snare/hats/bass)"* — 4 names, silently dropping
  `perc` (a real elemental stem) and never mentioning that `drums` and `mix`
  are also mutable/soloable rows in the same grid these tips are attached
  to (`StemMixer.tsx:244` wires `stemsHelp` — built from exactly these two
  keys — onto the "Stems" panel header that contains all 8 rows).
- Net effect: a user reading the panel's own help text to understand what
  they're looking at gets a materially incomplete/wrong inventory, then
  encounters `drums` and `mix` rows the copy never explained are *buses*
  (drums = kick+snare+hats+perc summed; mix = everything) rather than a 6th
  and 7th "part." Muting the `drums` bus while `kick` is separately soloed
  is a plausible confusing combination this UI invites and never explains.
- **Fix:** update `stems`/`glossaryStem` to name all 5 elementals plus
  call out `drums`/`mix` as combined-bus rows, e.g. append: *"'drums' and
  'mix' are combined buses, not extra parts — mute/solo those to check the
  whole group at once."* Small copy change, no logic touch.

## Checked and held up — verified, not assumed

Cross-referenced every acceptance line in `docs/ux-must-fixes-player-length.md`
against the current tree; all four are genuinely implemented, not just
claimed:

- **P0.1 (one readable clock)**: `TransportBar.tsx:423,431` gates the
  bar/section line strictly to `mode !== 'simple'` and applies the
  `.compact` class in Simple; `Waveform.tsx:481-482` keeps the full
  bar/section readout independently. No forked duration math — both read
  the same `playback`/`clockProgress` values from the store.
- **P0.2 (length before Generate)**: `SectionTimeline.tsx:143-148` computes
  `~m:ss` from the *pending* (post-drag/expand) bar count via
  `barsToDurationSec(bars, bpm)` and toasts exactly the spec'd copy,
  `` `Arrangement ~${approx} on next Generate` `` — not the old/current
  mix length.
- **P0.3 (seed off Simple hero)**: `App.tsx:188,196-198,203` — `ParamPanel`
  (which contains the seed row and "Keep seed" toggle, `ParamPanel.tsx:143-151`)
  only renders when `isSimple && moreOpen`, or in Power mode — never on the
  Simple hero/Generate row.
- **P0.4 (ACE shared-mix stem honesty)**: `StemMixer.tsx:164-166,235-238`
  computes `sharedMix` from `result.manifest?.gpuUsed` /
  `result.backendId?.startsWith('ace-step')` (real provenance, not a
  hardcoded guess) and swaps in `HELP.stemsSharedMix` / the "preview-relative,
  not isolated stems yet" hint line — never claims isolation on ACE.

Also checked, no gap found:
- Again/Vary button labels + tooltips (`TransportBar.tsx:482,494`) and
  `HELP.again`/`HELP.vary` all correctly state Again = same seed/settings,
  Vary = new seed/fresh arrangement — matches the CLAUDE bar's "Vary = new
  idea/new seed only" and `docs/knowledge/again-vary.md`.
- `helptip.test.ts` mechanically enforces What:/When:/What happens: +
  ≤160-char + jargon-ban on every `SIMPLE_HELP_KEYS` entry, and it's green —
  so P0-A/P0-B above are real gaps *underneath* a passing test suite, not
  things the tests were supposed to catch and missed a regression on (dead
  keys and per-button specificity aren't in that test's scope at all).

## FCC GRUNT handoff (hard-disjoint from PreviewPlayer/OfflineStub/ducking/mix-as-heard)

Implement + test, design already decided above — don't re-litigate:

1. **P0-A**: delete `powerMode`, `moreControls`, `badgeWebApp`, `timeline`
   from `src/ui/lib/helpCopy.ts` (HELP object + `SIMPLE_HELP_KEYS` array).
   Remove `'moreControls'`, `'badgeWebApp'` from the key list in
   `src/test/helptip.test.ts:43-103`. Run
   `npm.cmd test -- --run src/test/helptip.test.ts`.
2. **P0-B**: add `expandSection`, `repeatSection`, `dropX2` keys to
   `src/ui/lib/helpCopy.ts` (What/When/What happens, ≤160 chars, state the
   "only this section changes, same seed" guarantee), add to
   `SIMPLE_HELP_KEYS`. Wire onto the three buttons in
   `src/ui/components/SectionTimeline.tsx:239-279`, replacing the shared
   `HELP.sectionTimeline` on those three specific `<HelpTip>` call sites
   only (leave the other 3 `HELP.sectionTimeline` uses at `:160,183,196`
   untouched — those are the actual song-map tip, correctly generic).
3. **P1-A**: rewrite `HELP.stems` (`helpCopy.ts:60-61`) and
   `HELP.glossaryStem` (`:117-118`) to name all 5 elementals + explain
   `drums`/`mix` as bus rows, per the fix text above.
4. Files touched: `src/ui/lib/helpCopy.ts`, `src/ui/components/SectionTimeline.tsx`,
   `src/test/helptip.test.ts`. **Do not open** `PreviewPlayer.ts`,
   `OfflineStubBackend.ts`, `ducking.ts`, or anything under
   `src/core/audio/` — copy-only change, no DSP/backend touch needed.
   `StructureEngine.ts` not touched (P0-1 already closed; this is UI copy
   only, not new structure-engine work).
5. Verify: `npm.cmd test -- --run` + `npx tsc --noEmit` green.

## Verify (this session)

- `npm.cmd test -- --run`: **37/38 files, 227/230 passed, 2 skipped, 1
  failed** — `src/test/live-mixer-preview.test.ts > fallback
  loadMixFromStems ≡ Play buffer ≡ renderRemixedWavBlob > gain changes Play
  buffer; matches renderRemixedWavBlob DSP within 16-bit tol` (`expected
  0.1559 to be less than 0.01`). Same failure already flagged pre-existing
  in `PAID-P0-1-RESULT.md`; it's PreviewPlayer/gain-DSP territory (P0-3,
  FCC-owned) and no file in that area was opened this session. Not claiming
  this green — flagging per the project's soft-pass-forbidden rule.
- `npx tsc --noEmit`: **green**, 0 diagnostics (ran clean this session, no
  sandbox permission denial this time).
- No `src/` files were edited this session — this doc and the verify runs
  are the only output.
