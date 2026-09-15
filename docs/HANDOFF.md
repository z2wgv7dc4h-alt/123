# Handoff — read this first

Written 2026-09-15, end of a very long single session, because that session
ran high on token usage and is handing off to a fresh Claude. Everything
below is real, verified-where-marked, and current as of this commit. Read
this whole file before touching anything — it front-loads the one urgent
item, then gives full context so you don't have to re-derive it.

## 0. URGENT — do this first, before anything else

**The user's real legal name is still publicly exposed in this repo's git
history on GitHub right now.** Confirmed live on `origin/main` this session:

```
git log --all --format='%an <%ae>' | sort -u
  Wyatt <wyattlh@gmail.com>              <-- still here, still public
  z2wgv7dc4h-alt <z2wgv7dc4h-alt@users.noreply.github.com>
  z2wgv7dc4h@privaterelay.appleid.com
```

The GitHub account (`z2wgv7dc4h-alt`) is **deliberately pseudonymous** — the
user does not want their real name attached to it. All file *content* was
scrubbed this session (LICENSE, `src-tauri/Cargo.toml`, docs), and git
identity going forward is fixed (`git config user.name/user.email` now set
to the pseudonym). But the **commit history itself** — author/committer
name+email on every past commit, plus a couple of commit messages — still
says "Wyatt". This has NOT been fixed on the remote yet.

**Why it's not done**: `git filter-branch` is blocked for Claude by the
Claude Code auto-mode tool classifier ("[Git Destructive]") — this is not a
permission you can grant, it's a hard block on the tool call itself. Do not
try to route around it (no raw git plumbing tricks, no calling filter-branch
via a different shell invocation, nothing). This needs the **user** to run
it themselves.

**The fix is already written and sitting at the repo root**:
`rewrite-history.ps1` (untracked, deliberately not committed — it's a
one-off utility, not part of the app). It:
1. Writes `env-filter.sh` (rewrites author/committer "Wyatt" ->
   `z2wgv7dc4h-alt` / `z2wgv7dc4h-alt@users.noreply.github.com`) and
   `msg-filter.sh` (scrubs "Wyatt" out of commit message text).
2. Runs `git filter-branch -f --env-filter ... --msg-filter ... -- --all`.
3. Prints a verification block: author list (should show only
   `z2wgv7dc4h-alt`) and a grep of commit messages for "wyatt" (should be
   empty).
4. Tells the user to `git push --force` once both checks look right.

**Tell the user to open PowerShell in the repo root and run:**

```powershell
./rewrite-history.ps1
```

Then read its verification output back to them (or have them paste it back
to you) before they force-push. If the verification looks wrong, do NOT
have them force-push — stop and re-check the filter logic first. After a
confirmed-good force-push, re-run the `git log --all --format='%an <%ae>'`
check against `origin/main` to prove it's actually gone, and only then
consider this resolved. This has been pending across at least two prior
attempts this session (cmd.exe shell-syntax mismatches, then an "unstaged
changes" blocker from unrelated in-progress work) — don't assume it's
simple; walk the user through it directly if anything looks off.

## 1. What this project is

DnB Studio — browser-based drum & bass generator, two backends:
- **Sketch** (`OfflineStubBackend`, `src/core/backends/OfflineStubBackend.ts`)
  — pure CPU, deterministic Float32Array DSP synthesis, no GPU, no real
  audio samples anywhere.
- **Studio** (`AceStepBackend`, `src/core/backends/AceStepBackend.ts`) — real
  GPU inference via ACE-Step 1.5, running locally on the user's RTX 5080
  through a local bridge (`sidecar/ace_bridge_server.py` on `:8766` ->
  official ACE-Step API on `:8001`).

**They share almost nothing except the arrangement skeleton.** Same seed +
same knobs (energy/darkness/chaos/songShape) + same section edits produce
the same song *shape* (length, section boundaries, BPM, key) on either
backend, because both call `structureEngine.plan()`
(`src/core/structure/StructureEngine.ts`). ACE never receives OfflineStub's
actual synthesized drum hits or bass notes — only the caption text, section
timing tags, BPM, and its own seed. Every Sketch synthesis fix (voice
leading, filtering, sawtooth bass, etc. — see §2) only affects Sketch's own
sound and has **zero** effect on Studio/ACE output. The lever for Studio
quality is caption/prompt engineering and ACE's own request parameters —
see §3, this is the newest and most important finding of the session.

No git version control existed before 2026-09-15. An unsupervised
multi-agent pipeline (Grok orchestrator + Nvidia Nemotron file-writer +
Claude reviewer) ran ~7 hours on 2026-09-14 with no git under it, producing
heavy churn and ~150 files of one-off ticket/ops debris (removed this
session — still recoverable from git history). This session: git init,
pushed to GitHub, ~150 files of debris cleaned, full UI re-skin ("Club/Rave"
visual direction), real GPU stack verified live, a long chain of real
composition/synthesis bugs found and fixed from actual listening feedback,
a name-privacy scrub (content done, history rewrite pending — see §0), and
finally this review + handoff.

## 2. Fixed this session (all verified via tests and/or live rendering
   unless marked otherwise)

- **Silent ACE→Sketch fallback bug**: `generate()` in
  `src/ui/hooks/useStudioStore.ts` used to call `BackendRegistry.selectBest()`
  after already probing ACE itself — `selectBest()` re-probes a *second*
  time internally, and any hiccup on that second probe silently returned
  OfflineStub with no error, even right after the Studio badge had shown
  live. Fixed by reusing the first probe result directly. Reproduced twice
  on real hardware before the fix.
- **ACE received zero section structure** — `ace_bridge_server.py` hardcoded
  `lyrics: "[Instrumental]"` regardless of the arrangement map. Fixed:
  `AceStepBackend.ts` now sends `structureRef.sections`
  (name/startBar/lengthBars); the bridge maps them to ACE's real per-section
  lyric tags (`[Intro]`/`[Build]`/`[Drop]`/`[Breakdown]`/`[Outro]`).
  Confirmed in a raw ACE model log — the Lyric field now shows the real
  section sequence.
- **`DEFAULT_DESCRIPTORS` force-injection** (`src/core/types/index.ts`) was
  always appended to the ACE prompt regardless of what the user actually
  typed, diluting the signal. Changed the `StylePrompt` construction in
  `useStudioStore.ts` from `descriptors: [...DEFAULT_DESCRIPTORS]` to
  `descriptors: []`.
- **Bass voice leading**: bass notes could leap up to 19 semitones between
  consecutive notes with no register logic (`planBass()` in
  `StructureEngine.ts`, root cause of "sounds like nonsense, not composed at
  all" feedback). Fixed with an exact formula, not a candidate list:
  `nearestOctaveTo(target, prevMidi) = target - Math.round((target -
  prevMidi) / 12) * 12` — provably bounds every jump to ≤6 semitones.
  Exported `midiForRoot` from `StructureEngine.ts` for reuse. Tests:
  `src/test/bass-voice-leading.test.ts`.
- **Guitar/lead/rock-mid ignored the song's actual key** — `writeGuitarChord`,
  the solo, and `writeRockMid` in `OfflineStubBackend.ts` were hardcoded to
  fixed pitches (196 Hz / MIDI 57 / 520 Hz) regardless of `structure.keyRoot`
  — could clash outright in any other key, on top of being raw
  tanh-distorted sine with no filtering (read as a buzzy chiptune square).
  Fixed: all three now derive pitch from `midiForRoot(structure.keyRoot)`,
  the guitar layer voices a real power chord
  (`[root+12, root+19, root+24]`, two detuned oscillators per voice), and a
  lowpass (`lowpassInPlace`) shapes the distortion toward an amp tone. Tests:
  `src/test/guitar-layer-key.test.ts`.
- **Machine-gun hi-hats**: 32nd-note hats (`hatStep = 0.125`) were sustained
  through the *entire* drop/build section for syncopated/trap-bounce
  families — real DnB uses 16th notes (`0.25`) as the baseline, with 32nds
  only as an occasional roll/accent (researched against a real production
  reference, not guessed). Fixed in `planDrums()` — 32nds now only occur on
  a fill bar or with 15% chance per bar, not the whole section.
- **Crude drum synthesis rebuilt** after reading a real sample-free Web
  Audio drum synthesis reference (MIT-licensed,
  [dev.to/sendotltd](https://dev.to/sendotltd/sample-free-drum-synthesis-in-web-audio-building-kick-snare-and-hi-hat-from-oscillators-in-60-2c0k)):
  added a proper RBJ Audio EQ Cookbook resonant bandpass biquad
  (`bandpassInPlace` in `OfflineStubBackend.ts`) for snare crack and hat
  metallic ring — the old "filter" was a bare one-pole differencer (fizzy
  hiss, no resonance) — plus a steeper kick pitch-sweep for more attack, and
  a triangle-wave snare body instead of sine.
- **Reese/growl bass used sine oscillators, not sawtooth** — real reese bass
  is a detuned sawtooth stack. Added `sawFromTime()` (naive/non-bandlimited
  sawtooth) and rebuilt both character branches in `writeBass()` as 3-4
  voice detuned saw stacks through a lowpass; kept `sub` character as pure
  sine (correct — that's real production convention).
- **ACE caption engineering** (`src/core/prompt/buildAceCaption.ts`):
  rewrote to lead with an unambiguous "drum and bass" genre lock plus
  concrete real-DnB vocabulary (rolling breakbeats, sub bass, reese bass,
  amen/jungle chops, jump-up bassline, neurofunk-leaning) instead of vague
  mood adjectives that could describe any dance genre, with BPM moved to
  the very end (ACE's own prompting convention — genre first, BPM last).
  Also fixed a real duplicate-tag bug: user text was pushed as one un-split
  blob, so phrases like "rock-dnb crossover" could duplicate a structural
  tag with no way to catch it (confirmed in a raw ACE log — "rock-dnb
  crossover" and "174 bpm" both appeared twice in one caption). Now split
  on commas and deduped phrase-by-phrase via `pushDeduped()`.
- **Dubstep vs half-time-drop were byte-identical** (found and fixed in the
  final stretch of this session, NOT YET RE-VERIFIED by rendering — see §5
  "Not yet verified"). A single `halfTime` boolean in
  `HardGridStructureEngine.plan()` drove drums, bass character, energy
  curve, and the ACE caption addition identically for both shapes — proven
  via `scripts/render-styles.mjs` (renders all 4 song-shape presets at one
  seed, prints `family`/`bassChar`/`kickHits`/`snareBeatPositions`). Fixed
  by keeping the shared half-time snare-on-3 drum grid (that part is
  genuinely correct — both are real half-time grooves) but splitting
  everything else: added a separate `dubstepShape` flag; dubstep now biases
  bass character toward `growl` (`['growl','growl','reese']` vs half-time-
  drop's `['reese','growl','reese']`), gets a bigger energy-curve swing
  (dropBoost 0.5/introDip 0.44 vs 0.42/0.38), and a distinct ACE caption
  phrase. **Action item for you**: re-run `scripts/render-styles.mjs` (see
  §5) to confirm the two shapes now actually differ, since this session's
  Bash tool became unreliable (intermittent "classifier unavailable"
  errors — probably transient infra, not a real block) right after this
  fix landed and the render could not be re-confirmed before handoff.
- **Guitar/solo/extra-drums layers work in Sketch now** — pure CPU
  synthesis, no GPU needed, but the UI hard-disabled all four "Add heat"
  toggles behind `!aceHasGpu`. Fixed in `src/ui/components/LayersChips.tsx`
  with a `CPU_CAPABLE` set; only vocal-ish (no CPU synthesis path exists)
  stays Studio-gated.
- **UI re-skin**: "Club/Rave Energy" visual direction (magenta `#ff2ee8` /
  cyan `#00e5ff` / acid-green `#c6ff2e` on near-black, Space Grotesk font) —
  full `:root` CSS custom-property remap in `src/styles/app.css`, ~200
  stale hardcoded `rgba()` literals bulk-fixed, `Waveform.tsx` canvas colors
  updated to match (canvas fillStyle/strokeStyle is JS, not CSS — the
  variable remap doesn't reach it automatically).
- **Listen-first layout**: `App.tsx` restructured so TransportBar/Waveform/
  SectionTimeline/StemMixerCompact live in one sticky panel
  (`#generate-hero`), with style/shape/layer tweaks moved below as
  secondary "tweak, then Generate again" content.
- **Wake lock + render heartbeat**: `acquireRenderWakeLock`/
  `releaseRenderWakeLock`/`startRenderHeartbeat` wired around the ACE render
  call so a phone screen sleeping mid-render doesn't kill the job.
- **Name/identity scrub (file content only — history still pending, §0)**:
  removed the real name from every tracked file; `LICENSE` and
  `src-tauri/Cargo.toml` copyright changed to `z2wgv7dc4h-alt`; git identity
  config fixed going forward.

## 3. NOT fixed — the big findings from this session's final review

The user pushed back hard mid-session: "review the entire project... are we
doing this the best possible way? what aren't we leveraging? so far its
shit." Instead of guessing, the actual installed ACE-Step-1.5 repo was read
directly at `C:\Users\RIGGUSPIG\Documents\ACE-Step-1.5` (cloned there by
`scripts/windows/*.ps1` — NOT vendored in this repo) —
`acestep/api/http/release_task_models.py` (the real `GenerateMusicRequest`
Pydantic schema) and `acestep/constants.py` (`TASK_TYPES`, `TRACK_NAMES`,
`TASK_INSTRUCTIONS`). **If you need to re-verify any ACE-Step capability
claim, read those files again — don't trust this summary blindly, and don't
guess from general model knowledge; this is a real, versioned, locally
installed repo, read it.**

Concrete, sourced gaps, ranked by leverage-per-effort:

1. **The "Optional vibe" / Style Ref upload never reaches ACE as audio —
   highest leverage, most scoped.** `StyleDropZone.tsx` lets the user drop
   a track they own (explicit ownership checkbox required). Today that file
   is analyzed once client-side (`src/core/styleRef/analyzeAudio.ts`,
   `analyzeStyleReferenceFile`) into exactly three scalar numbers (estimated
   BPM, energy, brightness) that nudge the energy/darkness knobs — the
   actual audio is then discarded. `AceStepBackend.ts` never sends the file
   to the bridge at all; `job.styleReference` only flips a boolean
   (`acePathActive`) in the export manifest for honesty labeling. **This is
   deliberate and test-enforced, not an oversight** —
   `src/test/style-reference.test.ts` and `src/test/vibe-mirror.test.ts`
   explicitly assert `manifest.styleReference?.acePathActive === false`.
   The real ACE-Step API has a full audio-conditioning pipeline sitting
   completely unused: `task_type: "cover"` (in
   `acestep/constants.py:TASK_TYPES_BASE`) + `src_audio_path` +
   `audio_cover_strength` + `cover_noise_strength` is real audio-to-audio
   generation — bias the *actual sound*, not three derived numbers.
   `task_type: "repaint"` + `repainting_start`/`repainting_end` +
   `repaint_mode` (`conservative`/`balanced`/`aggressive`) +
   `repaint_strength` can regenerate just one section while preserving the
   rest. `sidecar/ace_bridge_server.py` hardcodes
   `"task_type": "text2music"` (line ~346) and the bridge doesn't even
   accept an audio file upload today. **The product already collects
   exactly the input this feature needs (owned reference track, explicit
   ownership attestation) and then throws it away.**
   **Important product-identity note**: wiring this changes what the UI's
   honesty copy currently promises. `StyleDropZone.tsx` says "Not a clone"
   and "we bias mood and energy of an original sketch" — real audio2audio
   conditioning means the output will genuinely resemble the reference more
   than a 3-number nudge does. That copy needs to be rewritten alongside
   the wiring, not after — don't ship the technical change with stale
   honesty copy. The user was asked which gap to prioritize and, given
   session token limits, asked instead for docs + this handoff + a push —
   **this item has NOT been started, only researched and written up**. It's
   the recommended first real implementation task for the next session,
   but confirm with the user before changing the "not a clone" framing,
   since that's a deliberate legal/honesty design choice made earlier this
   session, not just a technical default.
2. **`task_type: "lego"`** generates one named stem track (`TRACK_NAMES` in
   `acestep/constants.py` includes `drums`, `bass`, `guitar`, `synth`,
   `percussion`, `vocals`, etc.) conditioned on the audio context of the
   others. This is the real mechanism for actual separated ACE stems —
   right now all "stems" returned by the bridge mirror the same mix blob
   (honestly labeled as such in `AceStepBackend.ts`'s warnings/notes, see
   `stemsShareMixBlob`). Already flagged as "Not shipped" in
   README.md/ARCHITECTURE.md, but this session traced it to a real,
   already-installed, working API surface for the first time. Bigger lift
   than #1 (multiple round-trip generation calls per song, one per track,
   plus a mixdown step) — do #1 first.
3. **LoRA fine-tuning is a real, present feature of the installed ACE-Step
   repo**, not vaporware — `acestep.api.train_api_service
   .initialize_training_state`, wired into `api_server.py`'s FastAPI
   lifespan. `LoRAPackManager` in this app is currently "metadata + gates
   only, stub packs until CUDA train path" (per `docs/ARCHITECTURE.md`).
   Now that GPL/AGPL/NC licensing is a non-issue for this personal project
   (see §4), fine-tuning a LoRA on a small owned/curated DnB reference set
   is a real option for genre authenticity. This needs reference audio data
   and real GPU training time — treat as a later phase, not the next move.
4. **Sketch has zero real audio samples anywhere** — confirmed by grep,
   every DSP file under `src/core` is 100% synthetic oscillator math
   (sine/saw/square/noise + biquad filters). Now that GPL/AGPL/NC sample
   packs are fine to use personally (see §4), a real (even lightly
   processed) breakbeat sample layered into the kit would likely beat
   further synthesis tuning for "sounds like real DnB" — the genre is
   historically breakbeat-sample-based, not purely synthesized; no amount
   of oscillator tuning fully closes that gap. Scoped to
   `OfflineStubBackend.ts` only, no product-copy implications (unlike #1).
   Since Studio/GPU is the "real" path per the user ("why do i ever want to
   use sketch... theres no interaction right?" — confirmed answer: no,
   Sketch and Studio are independent, see §5 architecture note), this is
   lower stakes than #1 but still asked for explicitly ("get better sounds
   for sketch. theres lots of open source free shit").
5. Smaller/unverified: `inference_steps` — the bridge sends 50
   (`AceStepBackend.ts`), the real schema's own default is 8. Not
   necessarily wrong (more steps can mean higher fidelity on the non-turbo
   base model at more GPU time cost) but never verified against real
   quality-vs-speed data — just an inherited guess. `timesteps` (custom
   schedule override) and `dcw_enabled`/`dcw_mode` (post-hoc wavelet
   correction, in the real schema) are unset entirely — unexplored, no
   claim either way on whether tuning them would help. Don't touch these
   without real A/B evidence; this codebase's whole methodology this
   session was "get a source, don't guess."

## 4. Licensing — relaxed this session, owner decision

The user explicitly said: *"GPL/AGPL/NC-licensed tools - all are fine. this
is a personal project. not for commercial reasons."* This is a **personal,
non-commercial project** — GPL/AGPL/NC-licensed tools and libraries
(sample packs, synthesis engines, DSP code) are fine to integrate now, as
long as nothing is sold or redistributed commercially. The old "forbidden
in binary" list (ACE-Step-DAW/Strudel AGPL, MusicGen NC, Matchering/
Pedalboard GPL) was a commercial-distribution constraint that no longer
applies. Updated in `README.md`, `docs/ARCHITECTURE.md`,
`docs/ACCEPTANCE.md` (gate A4).

**This does NOT relax the separate ethical/copyright line** against
training on or cloning third-party artist catalogs, or building an
artist-clone product — that stays hard-forbidden, unchanged, unaffected by
the tool-licensing note. Don't conflate the two when doing future work
(e.g. #4 above — sourcing a real breakbeat sample from a CC0/GPL-licensed
pack is fine; ripping a break from a specific commercial track/artist is
not, regardless of this licensing relaxation).

## 5. Architecture clarity (asked for explicitly this session)

User asked directly: *"why do i ever want to use sketch? ... theres no
interaction right?"* Answer, confirmed by reading the code (not assumed):
**No interaction.** Sketch and Studio are independent rendering paths that
share only the deterministic arrangement skeleton (same seed + knobs ->
same song shape/length/sections/BPM/key via `structureEngine.plan()`).
Nothing composed or synthesized in Sketch transfers to Studio or vice
versa — a Sketch fix never touches Studio's sound, and a Studio-side
caption/prompt change never touches Sketch's sound. There is currently no
"start in Sketch, finish in Studio" workflow, and no code path that would
make one possible without new integration work (which nobody has asked
for). Sketch's only real value today: CPU-only preview / offline iteration
when the GPU stack isn't running, and layers (guitar/solo/extraDrums) that
now also work there. If the user's GPU is reliably available, Studio is
the primary path and always has been — this session's fixes made that
actually true (ACE was previously silently falling back, and receiving no
section structure — see §2).

## 6. Verification status — what to run first in the next session

This session's Bash tool became **intermittently unavailable** near the end
("deepseek-flash[1m] is temporarily unavailable, so auto mode cannot
determine the safety of Bash right now") — this looks like transient
infra flakiness in the tool-safety classifier, not a real permission
block (plain `git` commands worked fine throughout; `npx vite-node` /
`npx vitest` specifically kept failing right when verification was needed
most). **Do not assume this means anything is broken in the code** — it
means verification is simply unconfirmed. First thing to do in the next
session:

```bash
npx tsc --noEmit
npx vitest run
node scripts/render-styles.mjs   # or: npx vite-node scripts/render-styles.mjs
```

`render-styles.mjs` renders all 4 song-shape presets (`classic`, `dubstep`,
`trap-bounce`, `half-time-drop`) at seed 17400 and prints
`family`/`bassChar`/`kickHits`/`snareBeatPositions` for each, plus writes
WAV files to `exports/`. Confirm `dubstep` and `half-time-drop` now differ
(they should show different `bassChar` at least some seeds, given the
weighted-random pick — if you want a hard structural proof, temporarily log
the energy-curve dropBoost/introDip values too, since those differ
deterministically regardless of the RNG pick). If they're still identical,
re-check the edit in `src/core/structure/StructureEngine.ts` around the
`dubstepShape` variable (search for that name) — it should be a clean
compile since `tsc`/lint weren't run against it this session either.

All prior fixes in §2 (bass voice leading, guitar key-following, hi-hat
density, drum synthesis, reese/growl saw bass) were verified via passing
vitest suites and/or live rendering **before** this final unverified
change — those are solid. Only the dubstep/half-time-drop split (last edit
of the session) is unconfirmed.

## 7. Open listening-feedback loop — do not mark resolved without the user

Every round of "still sounds bad" feedback this session was met with a
demand for real evidence (dump actual data, read raw model logs, render
real audio, get it to the user via SendUserFile) before considering
anything fixed — this is the user's explicit, repeated methodology
preference, not just a one-off. The last confirmed status: a comparison
render was sent after the ACE caption rewrite, and **the user has not yet
confirmed it sounds right**. Don't claim composition/sound quality is
"fixed" or "resolved" anywhere (docs, chat, commit messages) until the user
explicitly says so after listening. `docs/STATUS.md` "Open questions" has
the full history of this back-and-forth.

## 8. Everything pending, in one list

1. **§0 — name scrub in git history**: script ready
   (`rewrite-history.ps1`), user needs to run it in PowerShell and
   force-push. Urgent/privacy-sensitive.
2. **§3.1 — wire real ACE `cover`/`repaint` audio2audio** for the Style Ref
   upload. Recommended next implementation task. Touches
   `sidecar/ace_bridge_server.py`, `src/core/backends/AceStepBackend.ts`,
   and `src/ui/components/StyleDropZone.tsx`'s honesty copy together.
3. **§3.2 — `lego` task_type for real separated stems.** Bigger lift, do
   after #2.
4. **§3.3 — LoRA fine-tuning investigation.** Later phase; needs reference
   data + GPU training time.
5. **§3.4 — real breakbeat samples for Sketch**, now license-unblocked.
   Contained to `OfflineStubBackend.ts`.
6. **§6 — re-verify the dubstep/half-time-drop fix** with a clean
   `tsc`/`vitest`/`render-styles.mjs` run; this session's Bash tool
   couldn't confirm it before handoff.
7. **Low-priority, previously flagged, still true**: `breakDensity` is
   hardcoded `0.55` in `AceStepBackend.ts` vs. derived from the chaos knob
   in `OfflineStubBackend.ts` — the two backends' "shared" arrangement
   isn't perfectly identical between them for the same seed. Low-impact
   (only shifts perc-hit/fill density, not core song shape).
8. **§7 — do not mark composition/sound quality "resolved"** anywhere
   until the user explicitly confirms after listening to a real render.
9. Continue iterating on composition/sound per further listening feedback,
   using the same evidence-first methodology as this entire session (real
   data, real logs, real sources — not guessing).

## 9. File map — where things actually live

- `src/core/structure/StructureEngine.ts` — deterministic arrangement
  planner (`HardGridStructureEngine`), shared by both backends.
- `src/core/backends/OfflineStubBackend.ts` — Sketch, pure CPU synthesis.
- `src/core/backends/AceStepBackend.ts` — Studio, talks to the local bridge.
- `sidecar/ace_bridge_server.py` — the local bridge (`:8766`), talks to the
  real ACE-Step API (`:8001`, run by `acestep-api` from the cloned repo).
- `C:\Users\RIGGUSPIG\Documents\ACE-Step-1.5` — the real, installed
  ACE-Step-1.5 repo (cloned by `scripts/windows/*.ps1`, NOT part of this
  repo/not vendored). Ground truth for ACE's actual API surface — read
  `acestep/api/http/release_task_models.py` and `acestep/constants.py`
  directly, don't rely on this handoff's summary alone for anything you're
  about to implement against it.
- `src/core/prompt/buildAceCaption.ts` — the ACE caption/tag builder.
- `src/ui/hooks/useStudioStore.ts` — Zustand store, `generate()` orchestrates
  both backends.
- `src/ui/components/StyleDropZone.tsx` — the "Optional vibe" upload UI.
- `src/core/styleRef/analyzeAudio.ts` — client-side vibe-file analysis
  (BPM/energy/brightness only, today).
- `docs/STATUS.md` — the detailed, chronological living-status log (more
  granular than this handoff — read it for exact dates/evidence citations).
- `docs/ARCHITECTURE.md`, `README.md`, `docs/ACCEPTANCE.md` — updated this
  session for the licensing change; ACCEPTANCE.md gate list is the honest
  "what's actually verified" checklist, keep it honest.
- `scripts/render-styles.mjs` — renders all 4 song-shape presets at one
  seed via direct Node import (vite-node), prints structural diagnostics.
  Kept in-tree; use it for any future song-shape work.
- `scripts/render-compare.mjs` — similar, for A/B comparing specific
  render configs (e.g. with/without a layer).
- `rewrite-history.ps1` — repo root, untracked, §0's git history fix.
