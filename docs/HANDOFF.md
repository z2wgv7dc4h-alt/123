# Handoff — read this first

Written 2026-09-15, end of a very long single session, because that session
ran high on token usage and is handing off to a fresh Claude. Everything
below is real, verified-where-marked, and current as of this commit. Read
this whole file before touching anything — it front-loads the one urgent
item, then gives full context so you don't have to re-derive it.

## 0. RESOLVED 2026-09-15 — name scrub in git history (was urgent)

**Done and confirmed on the remote.** The user's real legal name (author
"Wyatt <wyattlh@gmail.com>" on every pre-2026-09-15 commit) was rewritten
out of git history and force-pushed. Confirmed clean against `origin/main`
directly (not just local) via:

```
git log origin/main --format="%an <%ae>"
```

— every line now reads `z2wgv7dc4h-alt <...>`. Nothing further to do here.
Leaving the full story below for context/audit trail only.

<details>
<summary>How it was fixed (3 broken attempts before it worked — read if this
ever needs to be done again, e.g. a future rebase reintroduces it)</summary>

`git filter-branch` is blocked for Claude by the Claude Code auto-mode tool
classifier ("[Git Destructive]") — not a permission you can grant, a hard
block on the tool call itself. The user has to run it. The fix lived at the
repo root as `rewrite-history.ps1` (untracked, deliberately not committed —
a one-off utility, not part of the app; it may or may not still exist by the
time you read this).

Three real bugs surfaced running it from the user's terminal, fixed one at a
time by inspecting the actual error output:
1. **cmd.exe vs PowerShell**: `./rewrite-history.ps1` fails in cmd.exe
   (`'.' is not recognized`) — needs real PowerShell, or
   `powershell -File rewrite-history.ps1` from cmd.
2. **PowerShell execution policy** blocked the unsigned local script
   (`UnauthorizedAccess`) — fixed with
   `powershell -ExecutionPolicy Bypass -File rewrite-history.ps1` (a
   one-run bypass, not a system-wide policy change).
3. **`msg-filter.sh: No such file or directory`**: `git filter-branch`
   invokes the msg-filter from a different working directory than the
   script runs in, so a bare relative `msg-filter.sh` didn't resolve. Fixed
   by passing an absolute path — but a Windows backslash path
   (`C:\Users\...`) got its backslashes silently eaten somewhere in
   filter-branch's internal shell-quoting chain (came out as
   `C:UsersRIGGUSPIG...`, no separators). Fixed by converting to a Unix-style
   path instead (`/c/Users/...`), which Git Bash understands natively — no
   backslash-escaping involved.
4. **One more after that**: BOM. `Set-Content -Encoding utf8` in Windows
   PowerShell 5.1 writes a UTF-8 byte-order-mark, which bash's `sed` chokes
   on as literal garbage bytes prepended to the command
   (`$'\357\273\277sed': command not found`). Fixed by writing the filter
   scripts with `-Encoding ascii -NoNewline` instead (content was plain
   ASCII, no BOM issue with that encoding).

After all four fixes, the rewrite ran clean: author list showed only
`z2wgv7dc4h-alt`, commit-message grep for "wyatt" was empty, user ran
`git push --force`, and `git log origin/main` was checked directly to
confirm it actually landed on GitHub and not just locally.

</details>

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
- **Dubstep vs half-time-drop were byte-identical — found, fixed, and
  fully re-verified.** A single `halfTime` boolean in
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
  phrase. **First version of the fix still had a bug**: dubstep and
  half-time-drop reach the bass-character pick via the same seed and
  identical prior RNG draw count, so they read the exact same underlying
  random value there — and `'growl'` sat at the same middle index in both
  weighted arrays, so ~1/3 of seeds produced identical `bassChar` anyway
  (caught by actually re-rendering at seed 17400: came out `growl`/`growl`
  for both, not just eyeballing the diff). Fixed by having dubstep consume
  one throwaway `rng()` draw first, decorrelating the two streams. Verified
  clean: `npx tsc --noEmit` (0 errors), `npx vitest run` (240/241 pass —
  the one failure, `prove-gpu.test.ts`, needs the real ACE GPU stack
  running locally, unrelated to this change), and a re-render at seed
  17400 confirming `dubstep`→`bassChar=reese` vs
  `half-time-drop`→`bassChar=growl`, no longer colliding.
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

   **Exactly how the upload plumbing works — read directly from
   `C:\Users\RIGGUSPIG\Documents\ACE-Step-1.5\docs\en\API.md` §4.2/4.4,
   the project's own official API doc, not inferred from source code**.
   This is a complete, unambiguous implementation spec — don't re-derive
   it, just read that file's "Edit/Reference Audio Parameters" and "File
   Upload Method" sections directly if anything below is unclear:
   - `POST /release_task` supports two input methods. **Method A (JSON)**:
     `reference_audio_path` (style transfer) / `src_audio_path`
     (repaint/cover) as plain JSON string fields — but these require an
     *absolute path already on the ACE server's own disk*, which the
     browser obviously can't provide directly. **Method B (multipart/
     form-data)** is the one this project needs: send all the same fields
     as form fields, plus a file field named `reference_audio` (or
     `ref_audio`) for style transfer, or `src_audio` (or `ctx_audio`) for
     repaint/cover. The doc states explicitly: "After uploading files, the
     corresponding `_path` parameters will be automatically ignored, and
     the system will use the temporary file path after upload" — so the
     real API server itself handles the temp-file persistence
     (`save_upload_to_temp()` in `acestep/api/http/
     release_task_audio_paths.py`, confirmed in source too); nothing on
     our side needs to manage server-side file paths.
   - Real documented example (cover/repaint):
     ```bash
     curl -X POST http://localhost:8001/release_task \
       -F "prompt=remix this song" \
       -F "src_audio=@/path/to/local/song.mp3" \
       -F "task_type=repaint" \
       -F "repainting_start=10" \
       -F "repainting_end=20" \
       -F "chunk_mask_mode=explicit"
     ```
   - `audio_cover_strength` (float, 0.0-1.0, default 1.0): **the doc
     explicitly recommends lower values (~0.2) specifically for style
     transfer** — i.e. what this feature is for. Don't default to 1.0
     (max-strength cover, closer to literal reconstruction) — start
     around 0.2-0.3 and let the user tune it, matching the existing
     "vibe intensity" slider concept already in `StyleDropZone.tsx`.
   - The LM "thinking" caption-rewrite step is **automatically skipped**
     for `cover`/`repaint`/`extract` task types even if `thinking=true` is
     set (per the doc) — these tasks work directly from source audio, not
     from a text caption. Relevant because our current caption-engineering
     work (`buildAceCaption.ts`) has no effect on a cover/repaint request;
     don't spend time tuning the caption for this specific path.
   - Concretely, this means `sidecar/ace_bridge_server.py`'s `/render`
     handler needs to accept multipart/form-data (today it's JSON-only)
     and forward the browser's uploaded file straight through to ACE's
     `/release_task` as a `src_audio`/`reference_audio` form file; and
     `AceStepBackend.ts`/`useStudioStore.ts` need to send the actual
     `File`/`Blob` object from the `vibe` state (it's already held in
     memory client-side for the existing local analysis step — just also
     forward it, don't re-derive it) instead of only its filename/hash.
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
   lifespan; real tutorial at
   `C:\Users\RIGGUSPIG\Documents\ACE-Step-1.5\docs\en\LoRA_Training_Tutorial.md`
   (offline-readable, local file — also mirrored at
   [github.com/ace-step/ACE-Step-1.5](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/LoRA_Training_Tutorial.md)
   if online). `LoRAPackManager` in this app is currently "metadata + gates
   only, stub packs until CUDA train path" (per `docs/ARCHITECTURE.md`).
   Now that GPL/AGPL/NC licensing is a non-issue for this personal project
   (see §4), fine-tuning a LoRA on a small owned/curated DnB reference set
   is a real option for genre authenticity.
   **Concrete requirements** (via WebSearch of the real project docs —
   [RunComfy training guide](https://www.runcomfy.com/trainer/ai-toolkit/ace-step-1-5-lora-training),
   cross-check the local tutorial file above before acting on this):
   dataset = audio file + matching `.lyrics.txt` + metadata (BPM/key/
   caption) per sample, `.wav`/`.mp3`/`.flac`/`.ogg`/`.opus` all supported;
   **50-200 samples** in the target style, WAV 44.1kHz preferred, 80/20
   train/validation split; **16GB VRAM minimum, 20GB+ recommended** (the
   RTX 5080 has 16GB — right at the floor, watch for OOM on longer tracks);
   LoKR training mode cuts what used to take an hour to ~5 minutes on
   consumer GPUs. Reported common failure modes: dataset too broad, vague
   captions, messy lyrics files — a small, stylistically narrow dataset
   beats a large loose one. This needs real reference audio data (the
   user's own tracks or licensed-clear material — same catalog-training
   line from §0/README applies, don't scrape someone else's catalog for
   this) and real GPU training time — treat as a later phase, not the next
   move, but it's no longer a vague "maybe someday": the path is real,
   documented, and running on hardware already in this setup.
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
   **Real sources found this session (WebSearch, not guessed)**: the actual
   Amen break / Funky Drummer break are themselves copyrighted recordings
   with a legally murky sampling history — don't just rip the original
   James Brown/Winstons recordings even under the relaxed personal-project
   licensing (that's the separate catalog-rip/artist-clone line from §0's
   README/ARCHITECTURE update, not a tool-license question). Cleaner
   options that sidestep that entirely:
   - [Selekt Audio free drum MIDI](https://selektaudio.com/free-midi/drums)
     — CC0/public-domain/CC-BY drum **MIDI grooves with provenance
     certificates**, including Amen/Funky-Drummer-style patterns with no
     sampled audio at all — feed the groove into this project's own
     synthesis instead of playing back someone else's recording. Probably
     the cleanest option given this app already has a real drum synth path.
   - [KAN Samples' free Amen Break tribute pack](https://kansamples.com/blogs/free-drum-and-bass-sample-packs/amen-break-tribute-pack-free-drum-bass-sample-pack-free-download)
     and [Funky Drummer tribute pack](https://kansamples.com/blogs/free-drum-and-bass-sample-packs/funky-drummer-break-tribute-pack)
     — re-performed/re-recorded tribute breaks (not the original
     recording), free, DnB-specific.
   - [Freesound's Bronxio drumloops pack](https://freesound.org/people/Bronxio/packs/12756/)
     — CC0, explicit breakbeat sequences.
   - [Sample Focus](https://samplefocus.com/categories/drums) — royalty-free
     breakbeat/drum one-shots and loops, free tier.
   Verify each pack's actual license text yourself before use — search
   results describe them as CC0/free/royalty-free but don't take that as
   gospel without opening the pack's own license file.
5. **`inference_steps` — resolved, not actually a concern.** The bridge
   sends 50 (`AceStepBackend.ts`); flagged earlier this session as
   possibly-wrong since the schema's bare default is 8. Checked against the
   real project docs
   ([ACE-Step-1.5 INFERENCE.md](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/INFERENCE.md))
   via WebSearch: 8 is the turbo-speed default; for base/sft models (which
   is what this project uses — `acestep-v15-base`), 30-60 steps is the
   commonly recommended range for higher quality, and guidance_scale 5-9
   (this project sends 7.0) is the typical band. **50 is a reasonable,
   defensible choice, not an inherited guess** — no action needed here.
   One real lead worth trying, still unexplored: **Adaptive Dual Guidance**
   (`use_adg` in the real request schema, base-model-only, per the same
   docs) is described as improving quality at a speed cost — currently
   unset (defaults to off) in `AceStepBackend.ts`. `timesteps` (custom
   schedule override) and `dcw_enabled`/`dcw_mode` (post-hoc wavelet
   correction) remain genuinely unexplored — no claim either way on
   whether tuning them would help; don't touch without real A/B evidence.

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

## 6. Verification status — everything in §2 is confirmed

This session's Bash tool was intermittently unavailable for a stretch
("deepseek-flash[1m] is temporarily unavailable" — the tool-safety
classifier itself going down, not a real permission block; plain `git`
commands kept working throughout the outage). It recovered before handoff,
so every fix in §2, including the dubstep/half-time-drop split and its
own follow-up bug fix, has been run and confirmed, not left as an
open question:

```bash
npx tsc --noEmit        # 0 errors
npx vitest run          # 240/241 pass — only prove-gpu.test.ts fails,
                         # and only because it needs the real ACE GPU stack
                         # running locally (:8001/:8766); unrelated to any
                         # change this session
npx vite-node scripts/render-styles.mjs   # confirmed dubstep and
                         # half-time-drop now genuinely differ at seed 17400
```

If you ever touch `StructureEngine.ts`'s shape-dependent branches again,
re-run `render-styles.mjs` and actually read its output rather than
trusting the diff — this exact fix looked complete on first read but
still had a real RNG-correlation bug that only showed up by rendering and
comparing real output (see §2's entry for the full story of how it was
caught and fixed). Don't skip that step for "obviously correct" changes to
shape-branching logic; the collision here wasn't obvious from the code.

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

1. ~~**§0 — name scrub in git history**~~ — **DONE**, confirmed clean on
   `origin/main`.
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
  about to implement against it. **`docs/en/` inside that same repo has
  the real, complete official docs, fully offline-readable** (`API.md`,
  `INFERENCE.md`, `LoRA_Training_Tutorial.md`, `CLI.md`,
  `Large_Scale_SFT_Training_Guide.md`, `DCW.md`, and more — see
  `docs/en/index.md` for the full list) — if a future session has no
  internet access, this local copy is the fallback for anything WebSearch
  would otherwise have been used for regarding ACE-Step itself. Everything
  in §3 sourced from WebSearch this session (sample pack links, LoRA specs)
  was double-checked against these local docs where they overlapped —
  prefer the local docs over a web search result if they ever disagree,
  they're the actual shipped version running on this machine.
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
