# CRITIC-LISTEN-PASS — adversarial noob journey (DnB-Paid, brain)

Written 2026-09-14 by reading/running actual code (not trusting prior docs).
Journey walked: open → style → generate → play → tweak mute/solo/gain →
rehear → export. Every claim below is backed by a real file:line, verified
independently (not just accepted from the critic subagent's first pass).

**⚠ Coordination flag**: `DnB-FCC` is *currently live* on
`BRIEF-fcc-queue-slap-export.md`, whose own text is "export-as-heard vs live
tweak, OfflineStub slap regressions" — i.e. the same territory as P0-3 below.
Do not let two writers touch `PreviewPlayer.ts` / `OfflineStubBackend.ts` at
once. This doc did **not** touch either file — only `SectionTimeline.tsx` /
`app.css` (P0-2, unrelated area) were edited this session.

## P0 — table-stakes gaps found

### P0-1. Expand/×2 keeps the seed number but silently rewrites every downstream section's drums+bass anyway
- `src/core/structure/StructureEngine.ts:409` makes **one** `mulberry32(seed)`
  RNG for the whole song, threaded sequentially through `planSections` (`:423`),
  `pickPatternFamily` (`:428`), `planDrums` (`:429-439`) and `planBass`
  (`:441-451`) across the *entire* bar range in one pass.
- `planDrums` (`:120-290`) draws a variable number of `rng()` calls per bar
  depending on which probability branches fire (e.g. `chance(rng, …)` at
  `:155-268`). Because the calls are sequential and unkeyed per-section,
  changing one section's `lengthBars` (what Expand/×2/Repeat do — see
  `useStudioStore.ts:845-892`) shifts the RNG's position for every bar that
  comes after it in the stream.
- `generate()`'s seed-reroll gate (`useStudioStore.ts:945-956`) correctly
  skips re-rolling the seed number when `editedSections` is set, and
  `sectionsOverride: live.editedSections` is passed straight into
  `backend.render` (`:1045`) — so the *seed field* is genuinely preserved.
  But "same seed" ≠ "same song" here: expanding the drop (the `×2` button's
  actual target, `SectionTimeline.tsx:247-260`) regenerates the hats/kick/
  snare pattern and the entire bassline of every section after it.
- This is a direct violation of the product bar: *"Expand/×2 a section then
  Generate MUST keep the SAME seed and song; only stretch/repaint that
  section."*
- **Untested gap, not just unfixed**: `src/test/structure-expand.test.ts:202-207`
  and `src/test/listen-expand.test.ts:80` only assert `seed`/`editedSections`
  survive — neither test diffs the actual drum/bass hit arrays of unedited
  sections before vs. after an expand. This is the exact "weaker assertion
  lets the gap escape coverage" pattern called out in CLAUDE.md.
- **Not mechanical** — fixing this means keying RNG per-section (e.g. an
  independent sub-stream per section index, or `mulberry32(seed, sectionIndex)`
  consumed only for that section's own drum/bass planning) so editing one
  section's length can't perturb another's content. That changes what every
  existing seed produces, so it will require deliberately updating any test
  that pins exact hit arrays for a given seed — a real design change, not a
  patch. See GRUNT spec below.

### P0-2. Song map never showed a playhead during playback — **fixed this session**
- Before: `src/ui/components/SectionTimeline.tsx` had zero polling of
  `previewPlayer.getProgress()` and no visual marker — `Waveform.tsx:225-239`
  and `TransportBar.tsx:206-214` both correctly poll the shared
  `previewPlayer` clock via rAF, but the song map (which *can* seek — click
  handler at `SectionTimeline.tsx:197-209`) gave zero indication of where
  playback currently was. A user watching the map while listening could not
  tell which section was playing right now. Direct violation of *"player,
  waveform, and song map must all share ONE playhead."*
- Fix: added the same rAF-driven `previewPlayer.getProgress()` poll used by
  `Waveform.tsx` (`SectionTimeline.tsx`, new `playheadRatio` state + effect
  keyed on `previewState`), and an absolutely-positioned `.timeline-playhead`
  marker (`app.css`, new rule after `.timeline-interactive .timeline-track`)
  whose `left%` matches the same ratio math the existing click-to-seek handler
  already uses.
- Deliberately gated (`renderedBars > 0 && bars === renderedBars`) so the
  marker only draws when the visible section widths actually correspond to
  the audio currently playing — if there's a pending, not-yet-generated edit
  (`editedSections` set with a different bar count), the map is showing the
  *next* arrangement, not the current one, and the existing "Playing N ·
  next M" pill already flags that mismatch; drawing a playhead against the
  wrong-shaped track would be a new, self-inflicted desync.
- **Honesty note**: no new automated test added. This repo's test suite tests
  stores/pure functions, not rendered React DOM (`@testing-library/react` and
  `@testing-library/jest-dom` are devDependencies but unused — grepped zero
  `render(` component-mount call sites — and `vite.config.ts:38` sets
  `environment: "node"`, so JSX can't actually mount without also adding a
  DOM environment package that isn't installed). Verified by code reading
  against the identical, already-covered `Waveform.tsx` pattern instead of by
  ear/DOM assertion — flagging per the project's own honesty rule rather than
  claiming test coverage that doesn't exist.

### P0-3. Live bass is ducked twice; the exported "as heard" file doesn't match what's actually heard
- `src/core/backends/OfflineStubBackend.ts:778-782` calls `sidechainDuckBass`,
  which **mutates the `bass` buffer in place** before `bassOut = bass.slice()`
  (`:802`) becomes both the standalone `bass` `StemId` file and an input to
  the flat `mix`/`drums` buses. So the *elemental bass stem itself* — the
  same file `loadLiveFromStems` streams for live playback — already has the
  sidechain duck baked into its bytes.
- `src/core/audio/PreviewPlayer.ts:503-507` then inserts a **second**,
  independent duck stage on that same lane (`duckGain` node ahead of the
  `Tone.Channel`), driven by a live rAF envelope follower reading the kick
  channel (`startDuckLoop`, `:566-603`). The code's own comment at `:558-565`
  states the intent was to match "the flat/export mix (which ducks via
  `OfflineStubBackend.sidechainDuckBass` at render time)" — i.e. it was
  written on the assumption that the *live* bass stem is dry and only the
  flat mix bus is ducked. That assumption is false: the elemental `bass`
  stem itself already carries the bake.
- `renderRemixedWavBlob` (`PreviewPlayer.ts:779-820`), used for both the
  in-app "rehear" bake and the exported `mix_as_heard.wav`, sums the raw
  elemental stems + static gain + `applyMixBusGlue` only — it never applies
  the live rAF duck. So export gets exactly **one** duck application (the
  baked one); live playback gets **two** stacked. A user who tweaks mute/
  solo/gain, likes the (more-pumped) live sound, and exports gets audio that
  is measurably less ducked than what they just heard — a genuine
  export-as-heard violation, not a cosmetic one.
- **Doc contradiction**: `docs/knowledge/mix-as-heard.md:8` states *"Export
  also adds *_mix_as_heard.wav using the same DSP path as Play."* False for
  the sidechain duck specifically, per `PreviewPlayer.ts:779`'s own comment
  ("Same summing+glue path as export-as-heard (**NOT** the live Tone
  graph)"). The doc overstates what the code guarantees.
- **Not mechanical.** Two real design options, either of which touches both
  `OfflineStubBackend.ts` and `PreviewPlayer.ts`:
  1. Stop baking the duck into the standalone elemental `bass` stem (keep the
     bass array dry for the `bass` `StemId`; only bake the duck into the
     flat `mix`/`drums` bus computation). Then the live rAF duck becomes the
     *sole* source for live playback (correct — muting kick live already
     stops the sidechain signal via the analyser reading silence, so this
     also fixes "mute kick while playing" for free). `renderRemixedWavBlob`
     then needs to apply an equivalent duck itself (reusing
     `duckEnvelopeStep`/`computeDuckShapeParams` from `src/core/audio/ducking.ts`,
     run over the decoded kick+bass buffers at export time, respecting
     current mute/gain) so export still matches live.
  2. Or: drop the live rAF duck entirely and rely solely on the baked-in
     stem duck for both live and export. Simpler, but then muting the kick
     mid-play would *not* stop the bass pumping (since it's already baked
     into the bass audio bytes) — a separate, newly-introduced correctness
     gap this option would create. Not recommended without also solving that.
  Recommend (1). Needs a real test that decodes the exported `mix_as_heard`
  WAV and the live-graph's post-duck bass lane and asserts they match within
  tolerance — `src/test/live-duck-envelope.test.ts` currently only unit-tests
  the envelope math in isolation and would not catch this class of bug.

## P1 — real, not table-stakes (no action taken, out of this pass's explicit scope)

- **`.bak`/`.bak40` dead files left in tree**: confirmed no live import
  anywhere references `src/core/audio/PreviewPlayer.ts.bak`,
  `PreviewPlayer.ts.bak40`, or `src/ui/hooks/useStudioStore.ts.bak` (grepped;
  all real imports resolve to the non-`.bak` files). Not a live-import risk,
  but stale, much-smaller duplicate files sitting next to their real
  counterparts is exactly the kind of clutter CLAUDE.md's lessons-learned
  section warns about. Should be deleted as trivial cleanup, not left as "may
  be needed later."
- **Non-elemental mixer refresh path stops/reseeks/replays** instead of a
  pure `Tone.Channel` update: `useStudioStore.ts:395-437`
  (`refreshPreviewAfterMixerChange`) only takes the instant-update fast path
  when `previewPlayer.hasLiveGraph()` is true; otherwise it fully reloads +
  reseeks + replays. Gated out of the common UI path today via `liveMixerOk`
  (`App.tsx:51-54`), so not hit in practice, but a real glitch waiting for
  any backend that returns a flat-only mix.

## Checked and held up (no gap — verified, not assumed)

- Player↔waveform clock: `Waveform.tsx:225-239` / `TransportBar.tsx:206-214`
  both poll the same `previewPlayer.getProgress()`/`getDurationSec()` — one
  real clock, no drift, confirmed by reading `PreviewPlayer.getProgress()`
  (`PreviewPlayer.ts:108-115`).
- Click-a-section-while-playing → select+seek is real, not cosmetic:
  `SectionTimeline.tsx:197-209` → `seekPreview` → `PreviewPlayer.seek`
  actually retimes in-progress playback.
- Vary vs Again vs Generate seed handling matches
  `docs/knowledge/again-vary.md`: `useStudioStore.ts:945-956` (reroll gate)
  and `:335-352` (`applyVaryDiversity`, always rolls a fresh
  `crypto.getRandomValues` seed) are consistent with the doc.
- ACE stem honesty: `AceStepBackend.ts:266-294` correctly flags when returned
  stems fall back to sharing the mix blob; `StemMixer.tsx:235-249` only shows
  the "not isolated stems" warning for ACE/GPU results, not Sketch/OfflineStub
  (which do have real independent stems). No fake-isolated-stem claim found.
- HelpTips: every `HELP.*` key referenced across ~20 components resolves in
  `helpCopy.ts`; `waveform-seek.test.ts:108-123` hard-enforces
  What:/When:/What happens: structure + 160-char cap.

## GRUNT list for FCC (design specs above; implement + test, don't re-litigate design)

1. **P0-1 fix** — key `StructureEngine`'s RNG per section so `Expand`/`×2`/
   `Repeat` only changes the edited section's own drum+bass content, never
   downstream sections'. Update `structure-expand.test.ts`/
   `listen-expand.test.ts` to actually diff unedited-section hit arrays
   before/after an edit (not just seed/editedSections presence). Expect other
   tests pinning exact per-seed output to need deliberate updates — that's
   expected fallout of a real RNG-derivation change, not a regression to hide.
2. **P0-3 fix** — implement option (1) above: stop baking the sidechain duck
   into the standalone `bass` elemental stem; keep the live rAF duck as sole
   source for live playback; make `renderRemixedWavBlob` apply the same duck
   algorithm (reuse `src/core/audio/ducking.ts` exports) so exported
   `mix_as_heard.wav` matches what was actually heard live, including when
   kick is muted/soloed-out. Add a test that decodes both paths and compares.
3. Both items: `npm.cmd test -- --run` + `npx tsc --noEmit` green when done.
   **Note**: this session's `tsc` is denied at the sandbox permission layer
   for every invocation form (`npx tsc`, `npx.cmd tsc`, `./node_modules/.bin/tsc`,
   `node ./node_modules/typescript/bin/tsc`, all tried) — no approval surface
   available here. `npm.cmd test -- --run` runs fine. If FCC's sandbox has the
   same restriction, flag it rather than silently skipping the check.
4. Do not touch `SectionTimeline.tsx`'s new playhead code (P0-2, already
   fixed and unrelated) while working P0-1/P0-3.

## Verify (this session)

- `npm.cmd test -- --run`: **green** — 38/38 files, 226 passed / 2 skipped, 0
  failed (re-ran after the P0-2 edit).
- `npx tsc --noEmit`: **not verified** — denied at the sandbox permission
  layer for every invocation attempted (see GRUNT note #3). Not a code
  failure; needs an interactive session or a sandbox with an approval
  surface to close out. Only files touched this session
  (`src/ui/components/SectionTimeline.tsx`, `src/styles/app.css`) are a small,
  type-light diff (new `useState`/`useEffect` using existing, already-typed
  `previewPlayer.getProgress()` and `useStudioStore` selectors, plus a CSS
  rule) — low risk, but unverified is unverified; stating it plainly per the
  project's own honesty rule rather than claiming green.
