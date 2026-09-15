# Session Dump — 2026-09-15 → 2026-09-16

Written at the end of one very long single session, on explicit instruction
to dump everything to disk so a fresh chat can pick up with zero transcript.
Every claim below is grounded in a tool call actually run this session (git
log, file listings, test runs) — not memory of intent. If anything here
disagrees with the repo, the repo wins; re-run the commands in §5 to check.

## 1. Goal (3 lines)

Take an unsupervised multi-agent pipeline's 7-hour, no-git-history burst and
turn it into a real, versioned, honestly-documented project; fix the actual
composition/sound-quality bugs a human listener kept flagging as "sounds
wrong," using real evidence (raw logs, real audio, real upstream source)
instead of guessing; and, once GPL/AGPL/NC licensing was explicitly
relaxed for this personal project, find and start using real external
resources (breakbeat samples, the real ACE-Step API surface) instead of
hand-rolled synthesis and unused API defaults.

## 2. Workstreams (chronological)

### Version control & identity

- **Decided**: git-init the project (had none before this session),
  push to a real remote, keep a pseudonymous GitHub identity
  (`z2wgv7dc4h-alt`) with the owner's real name fully scrubbed —
  from file content *and* commit history.
- **Landed**: `.git` initialized, pushed to
  `https://github.com/z2wgv7dc4h-alt/123`. Real name scrubbed from every
  tracked file (`LICENSE`, `src-tauri/Cargo.toml`, docs). Git history
  rewritten via `git filter-branch` (script: `rewrite-history.ps1`, repo
  root, untracked on purpose) and force-pushed — confirmed clean directly
  against `origin/main` (`git log origin/main --format="%an <%ae>"` shows
  only `z2wgv7dc4h-alt`).
- **Discussed, not built**: nothing outstanding here — this thread is
  closed.
- **Tests**: N/A (infra, not app code). Verify by re-running the
  `git log origin/main` check in §5 if this is ever in doubt again.

### UI / UX

- **Decided**: "Club/Rave Energy" visual direction (magenta/cyan/acid-green
  on near-black); a listen-first sticky panel over the old scroll-everything
  layout; unlock guitar/solo/extraDrums layer toggles for Sketch (CPU-only,
  no GPU needed) instead of hard-gating all four behind `aceHasGpu`.
- **Landed**: `src/styles/app.css` (`:root` custom-property remap, ~200
  `rgba()` literals fixed), `src/ui/components/Waveform.tsx` (canvas colors,
  glow playhead), `src/App.tsx` (sticky `#generate-hero` panel),
  `src/ui/components/LayersChips.tsx` (`CPU_CAPABLE` set).
- **Discussed, not built**: nothing outstanding.
- **Tests**: `src/test/simple-process-order.test.ts` (layer gating logic).
  No visual-regression tests exist (none expected — pure CSS/layout).

### Studio (ACE-Step 1.5 / GPU backend)

- **Decided**: Studio is the *real* generation path on the user's RTX
  5080 — Sketch is CPU fallback only, not a creative sandbox that feeds
  into Studio (confirmed by reading the code: they share only the
  deterministic arrangement skeleton via `structureEngine.plan()`, nothing
  else). Fix the two real bugs found by actually running the live GPU
  stack, then research (don't guess) what the real ACE-Step API can do
  that this project isn't using yet.
- **Landed**:
  - Fixed silent ACE→Sketch fallback (`useStudioStore.ts`'s `generate()`
    no longer calls `BackendRegistry.selectBest()`, which re-probed a
    second time and silently swallowed hiccups).
  - Fixed ACE receiving zero section structure (`AceStepBackend.ts` now
    sends `structureRef.sections`; `sidecar/ace_bridge_server.py` maps
    them to real ACE lyric tags).
  - Render wake lock + heartbeat wired around the ACE call.
  - `buildAceCaption.ts` rewritten with real DnB vocabulary + a real
    duplicate-tag dedup bug fixed (`pushDeduped`).
  - Dubstep vs half-time-drop caption text differentiated (was identical).
  - **Research only, nothing implemented**: read the real, locally
    installed ACE-Step-1.5 repo
    (`C:\Users\RIGGUSPIG\Documents\ACE-Step-1.5`, cloned by
    `scripts/windows/*.ps1`, NOT part of this repo) directly —
    `acestep/api/http/release_task_models.py`, `acestep/constants.py`,
    and `docs/en/{API,DCW,GRADIO_GUIDE,LoRA_Training_Tutorial}.md`. Found:
    real audio2audio (`task_type: "cover"`/`"repaint"`, multipart upload
    fields `src_audio`/`reference_audio`, `audio_cover_strength`
    recommended ~0.2 for style transfer) sitting completely unused despite
    the "Optional vibe" upload UI already collecting the exact input it
    needs; `task_type: "extract"` (not `"lego"` — corrected after first
    getting this wrong) as the real fix for "stems mirror the mix"; DCW
    (free, training-free quality correction, silently off by default on
    the non-Turbo base model this project uses); LoRA training
    (real, documented, running-on-this-hardware feature, not vaporware).
    Full spec for all of this is in `docs/HANDOFF.md` §3 — **do not
    re-derive it, read that section**.
- **Discussed, not built**: audio2audio/cover wiring, `extract` stems,
  DCW opt-in, LoRA training, `use_adg`. All Studio-side, all researched
  and spec'd, **none implemented**. See TICKETS/.
- **Tests**: `src/test/ace-backend-render.test.ts`,
  `src/test/ace-caption-vary.test.ts`, `src/test/prove-gpu.test.ts`
  (the last one **needs the live GPU stack running** — 2 tests in it fail
  right now simply because the stack isn't up; not a regression).

### Sketch (OfflineStubBackend / CPU synthesis)

- **Decided**: Sketch's composition engine (note selection, pattern
  families) was "not obviously broken" on inspection — the actual problems
  were in timbre/synthesis and structural bugs, found one at a time from
  real listening feedback, never from guessing.
- **Landed**:
  - Bass voice leading (`nearestOctaveTo()`, exact formula not a candidate
    list — bounds every jump to ≤6 semitones).
  - Guitar/lead/rock-mid pitch now follows the real song key
    (`midiForRoot`), guitar voices a real power chord, both filtered.
  - Hi-hat density fixed (16ths are the real baseline; 32nds only on a
    fill bar or 15% chance, not the whole section).
  - Kick/snare/hat synthesis rebuilt with a real resonant bandpass biquad
    (RBJ Audio EQ Cookbook), replacing a bare one-pole differencer.
  - Reese/growl bass rebuilt as detuned sawtooth stacks, not sine stacks.
  - Reese detuning **widened** from ~±12/±24 cents to ~±17/±31 cents,
    matching commonly-documented real Reese practice (~±30 cents) —
    found via WebSearch, applied, typechecked, tested.
  - **Real breakbeat sample loops layered in** (see next workstream) —
    the single biggest Sketch change this session.
- **Discussed, not built**: the two raw (non-pre-cut) sample files the
  user separately downloaded (`funky-amen_175bpm.wav` at 175 BPM,
  `funky-drummer-drums_105bpm_E_minor.wav` at 105 BPM) were never
  integrated — they'd need real time-stretching; skipped because the KAN
  Samples zip packs had pre-cut-to-174bpm versions that needed none.
  Selekt Audio's CC0 MIDI grooves and Sample Factory's individual one-shot
  pages were found but never fetched (redundant once the KAN packs
  worked).
- **Tests**: `src/test/bass-voice-leading.test.ts`,
  `src/test/guitar-layer-key.test.ts`, `src/test/break-loop.test.ts` (new,
  9 tests, covers the WAV decoder + loader — see next workstream).

### Shared structure engine — song-shape differentiation

- **Decided**: "Dubstep feel" and "Half-time drop" must actually differ
  end to end, not just by name.
- **Landed**: found via `scripts/render-styles.mjs` that both shapes
  produced byte-identical `bassChar`/`kickHits`/`snareBeatPositions` (one
  `halfTime` boolean drove both, everywhere). Fixed in
  `src/core/structure/StructureEngine.ts`: kept the shared half-time
  snare-on-3 drum grid (that part is genuinely correct for both real
  genres) but split bass-character bias, energy-curve dynamics, and the
  ACE caption text. **First fix attempt had a real bug**: both shapes
  reach the bass-character pick via the same seed + identical prior RNG
  draw count, so they read the same underlying random value, and
  `'growl'` sat at the same array index in both weighted lists — caught
  only by actually re-rendering (not by re-reading the diff), fixed by
  having dubstep consume one throwaway `rng()` draw first to decorrelate
  the streams.
- **Discussed, not built**: nothing outstanding on this specific bug.
- **Tests**: no dedicated unit test for the RNG-decorrelation fix itself
  (verified by direct render + inspection, `scripts/render-styles.mjs`,
  not by an automated assertion) — **this is a real gap, see TICKETS**.
  `src/test/structure-shapes.test.ts`, `src/test/pattern-family-vary.test.ts`
  pass but don't specifically assert dubstep ≠ half-time-drop.

### Sample assets — real break loops (Sketch)

- **Decided**: once GPL/AGPL/NC + "personal project, catalog rips are
  fine" was confirmed explicitly by the owner, integrate real breakbeat
  audio instead of only tuning synthesis further.
- **Landed**:
  - `src/core/audio/wavDecode.ts` — dependency-free RIFF/WAVE PCM decoder
    (16/24-bit, mono/stereo), works identically in Node and browser.
  - `src/core/audio/loadBreakLoop.ts` — dual-path loader (fetch in
    browser, `node:fs` in Node via `import.meta.url` resolution), caches
    by `(name, barSamples)`.
  - `src/core/audio/node-fs-shim.d.ts` — narrow ambient `declare module
    'node:fs'` so the loader typechecks without installing `@types/node`
    (see Don't-do list — installing it would leak Node globals project-
    wide since this tsconfig has no `types` array).
  - `src/assets/samples/breaks/{amen_174bpm_1bar,funky_drummer_174bpm_1bar}.wav`
    + their `LICENSE_*.txt` — real KAN Samples "tribute" break loops,
    pre-cut to exactly one bar at 174 BPM (this project's locked tempo),
    so no time-stretch/pitch-shift needed, just a per-bar tile.
  - `buildRealBreakBus()` in `OfflineStubBackend.ts` — additive-only
    layer under drop-section bars for `amen`/`twoStep` pattern families
    (`syncopated` intentionally left pure-synth, no strong genre match).
    Mixed into `mix` post-mixdown, before the soft-ceiling glue — never
    touches any individually-tested stem bus.
  - User confirmed by ear: **"it sounds a little better."**
- **Discussed, not built**: no UI toggle to disable/adjust the real-break
  blend level — it's always-on for those two pattern families right now,
  at a fixed gain (`REAL_BREAK_GAIN = 0.32`). No stem/manifest honesty
  label added yet saying "this mix contains a real sample loop" (the
  existing manifest/stem-honesty system doesn't know about this bus at
  all yet) — **real gap, see TICKETS**.
- **Tests**: `src/test/break-loop.test.ts` (9 tests: decoder correctness
  on synthetic WAVs, mono-downmix, resampling, real-asset loading,
  caching). **No test asserts the real break is actually audible in a
  full `OfflineStubBackend.render()` output** — coverage stops at the
  loader, doesn't reach the integration point. **Real gap, see TICKETS.**

### Docs & process

- **Landed**: `README.md`, `docs/ARCHITECTURE.md`, `docs/ACCEPTANCE.md`
  updated for the licensing relaxation (GPL/AGPL/NC tools fine for this
  personal/non-commercial project; catalog-rip/artist-clone line
  unaffected, still hard). `docs/STATUS.md` extended repeatedly as the
  chronological evidence log. `docs/ARCHITECTURE.md` gained a real,
  previously-undocumented rationale for the Tone.js-not-as-synth-engine
  rule (asked directly by the owner, answered from reading the code:
  deterministic reproducibility + the entire Node-based render/test
  workflow depends on zero `AudioContext` dependency). `docs/HANDOFF.md`
  was written, then **superseded by this file and the refreshed
  `docs/HANDOFF.md`** — that file is now the pickup entry point, this
  file is the full inventory behind it.

### Tests (cross-cutting posture)

- 42 test files under `src/test/`. Last known-good full run:
  **249 passed, 2 failed, 2 skipped** — the 2 failures are both in
  `src/test/prove-gpu.test.ts` and require the live ACE GPU stack running
  on `:8001`/`:8766`; not a regression, expected whenever that stack is
  down. `npx tsc --noEmit` clean as of the last commit (`f9c6176`).
- Real gaps (see TICKETS for the concrete tickets):
  1. No test asserts dubstep ≠ half-time-drop structurally (verified by
     manual render only).
  2. No test asserts the real break loop is actually mixed into a full
     `render()` output (coverage stops at the loader).
  3. No honesty/manifest label exists for "this Sketch mix contains a
     real sample loop" — every other special-case bus in this codebase
     (style ref, perc, guitar/solo) has one; this one doesn't yet.

## 3. Resources identified this session — usage status

| Resource | Status | Why |
|---|---|---|
| KAN Samples Amen Break Tribute pack | **used** | Zip'd, pre-cut 174bpm cuts extracted, one committed to `src/assets/samples/breaks/` |
| KAN Samples Funky Drummer Break Tribute pack | **used** | Same; owner explicitly OK'd its license admitting the audio is lifted from the original recording, not a re-performance |
| Raw `funky-amen_175bpm.wav` (user's Downloads) | **unused** | Needs real time-stretch (175→174 BPM); pre-cut zip version needed none, used that instead |
| Raw `funky-drummer-drums_105bpm_E_minor.wav` (user's Downloads) | **unused** | Same reason, bigger stretch factor (105→174) |
| Freesound Bronxio CC0 drumloops pack | **skipped** | Requires a Freesound account login; user couldn't log in |
| Sample Focus individual one-shot pages (funky-amen, funky-drummer-drums) | **skipped** | Redundant once the KAN packs worked |
| Selekt Audio CC0/PD drum MIDI grooves | **documented-only** | Different approach (MIDI pattern, not audio) — never fetched |
| ACE-Step `cover`/`repaint` audio2audio (real API, spec'd) | **documented-only** | Studio-side; full implementation spec in HANDOFF §3.1; not built |
| ACE-Step `extract` task type (real stems) | **documented-only** | Studio-side; corrected from an earlier wrong "lego" framing; not built |
| ACE-Step DCW (quality correction) | **documented-only** | Studio-side; concrete recommended settings known; not built |
| ACE-Step LoRA training | **documented-only** | Studio-side; concrete dataset/VRAM specs known; needs real reference audio + GPU time; not built |
| ACE-Step `use_adg` (Adaptive Dual Guidance) | **documented-only** | Studio-side; flagged as unexplored lead |
| Kickmess / Geonkick / WeirdDrums / RipplerX (open-source synth engines) | **rejected for direct integration** | C++/JUCE plugins, not JS-importable; algorithm-reference-only if ever revisited |

## 4. Commands that work (verified this session)

```bash
# Install (Windows: use npm.cmd, not bare npm — see CLAUDE.md)
npm.cmd install

# Run Studio: start the real ACE GPU stack, then the app
scripts/windows/start-ace-stack.ps1     # ACE API :8001 + bridge :8766
npm.cmd run dev                          # Vite dev server; Studio auto-detects the live probe

# Run Sketch: same dev server, just don't start the ACE stack — Sketch is
# the automatic fail-soft fallback when the Studio probe doesn't answer.
npm.cmd run dev

# Typecheck
npx tsc --noEmit

# Full test suite
npx vitest run
# or, per CLAUDE.md convention:
npm.cmd test -- --run

# One render/diagnostic script (renders all 4 song shapes, prints
# family/bassChar/kickHits/snareBeatPositions, writes WAVs to exports/)
npx vite-node scripts/render-styles.mjs
```

## 5. Known failures (as of commit `f9c6176`)

- `src/test/prove-gpu.test.ts` — 2 of 2 tests fail (`should probe and
  report GPU` times out; `should render a short segment` gets a 503) —
  **only when the ACE GPU stack isn't running**. Start it first
  (`scripts/windows/start-ace-stack.ps1`) if this needs to be green.
- Everything else: 249 passed, 2 skipped, `tsc` clean.

## 6. Don't-do list (real dead ends hit this session — don't repeat them)

- **Don't install `@types/node`** in this project. This tsconfig has no
  `types` array, so TS auto-includes every `@types/*` package found —
  installing it would leak Node globals (`Buffer`, `process`, ...) into
  every browser-side file. Use a narrow local ambient `.d.ts` instead
  (see `src/core/audio/node-fs-shim.d.ts` for the pattern).
- **Don't try to log into Freesound** to fetch samples on the user's
  behalf — it's account-gated and the user does not have working login
  access to it right now.
- **Don't run `git filter-branch` or `git remote add` directly from
  Claude Code's own Bash/PowerShell tool** — both are hard-blocked by the
  auto-mode tool-safety classifier ("[Git Destructive]" /
  "[Data Exfiltration]"). This is not a permission you can get granted;
  write the exact script/commands to a file and have the user run them
  in their own terminal.
- **Don't assume the user's shell is bash just because a command "looks
  like bash."** This session hit real failures from cmd.exe vs
  PowerShell vs Git Bash mismatches (`'.' is not recognized`,
  `UnauthorizedAccess` on unsigned scripts, etc.). Ask or give the exact
  invocation for the shell actually in front of the user.
- **Don't use `Set-Content -Encoding utf8` in PowerShell** for any file a
  Unix tool (bash, sed) will later read — Windows PowerShell 5.1's
  "utf8" encoding writes a BOM that breaks naive byte-stream parsers
  (`sed` choked on `$'\357\273\277sed'`). Use `-Encoding ascii` for plain
  text, or `-NoNewline` where a trailing newline isn't wanted.
- **Don't pass Windows backslash paths into a shell command that's
  itself embedded inside another generated shell script** (e.g. git
  `filter-branch`'s `--msg-filter`) — the backslashes got silently eaten
  (`C:\Users\...` became `C:UsersRIGGUSPIG...`, no separators at all).
  Convert to a `/c/Users/...`-style Unix path first.
- **Don't conflate ACE-Step's `extract` and `lego` task types.** `extract`
  isolates one instrument from audio that already exists (the fix for
  "stems mirror the mix"); `lego` generates a *new* track conditioned on
  others' context (adding instrumentation, a different feature). Getting
  this backwards was a real mistake caught and corrected this session.
- **Don't trust a sample pack's marketing/landing-page framing over its
  actual bundled license file.** The Amen and Funky Drummer packs from
  the same vendor, downloaded the same way, carry meaningfully different
  license terms — only visible by opening the `.txt` file inside the zip,
  not from the download page's blurb.
