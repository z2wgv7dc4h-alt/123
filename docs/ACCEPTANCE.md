# Acceptance gates (Phase 0/1)

Honest checklist — only [x] what exists and is verified in-tree. Soft-pass forbidden on ACE/GPU.

## Phase 0 DoD

- [x] IAudioBackend / IStructureEngine / LoRAPack contracts used
- [x] OfflineStubBackend real WAV blobs (CPU sketch)
- [x] Structure 174 hard grid intro/build/drop/break/outro (version hard-grid-v0)
- [x] Preview Tone.Player / AudioBufferSourceNode mix WAV only
- [x] Export stems WAV + manifest JSON + MIDI + zip helper; remixed Export also adds `mix_as_heard.wav`
- [x] AceStepBackend GPU required fail-soft (probe hasGpu false in browser)
- [x] Registry defaults to OfflineStub via selectBest
- [x] Style descriptors pass through (scrubArtistNames no-op; artist words allowed as vibe text — still no catalog rips / stem clones / clone product)
- [x] Simple + Power Mode UI (browser prototype)
- [x] Sketch vs Studio retail product modes (chrome + badge + export labeling; Studio gated fail-soft when !aceHasGpu — soft-pass forbidden)
- [x] Bit-depth honesty: Sketch exportBitDepth 16|24 (default 16) in store + Power/More & Export-adjacent control; exportZip/exportStems/mix_as_heard/Download heard re-encode via encodeWav; manifest+toast label 16-bit/24-bit Sketch (not Studio); vitest export-bit-depth.test.ts — not gated on Studio GPU; soft-pass forbidden
- [x] README + THIRD_PARTY_NOTICES + ARCHITECTURE docs (honest CPU vs 5080; listen/modify + export paths)
- [x] scripts/download-ace-step.md + sidecar/README + sidecar/stub_server.py (stdlib localhost API sketch on :8765; hasGpu=false /render 503 — not live CUDA)
- [x] CPU vitest suite (seed, WAV header, no-scrub style descriptors, Ace throw, registry, honesty, mix_as_heard ZIP, mixerDirty)
- [x] Stem mixer mute/solo/gain (−24…+6 dB) remixed into preview on Play; when remixed, Export ZIP adds `mix_as_heard.wav` (same DSP path as preview); dry stems + dry mix remain for DAW (wired in useStudioStore + download.ts)
- [x] Transport hotkeys G / Space / E when not typing (wired in useTransportHotkeys)
- [x] Again / Vary regenerate (TransportBar after result; RegenAffordance when paramsDirty; Vary rolls new seed; wired — no dedicated vitest yet)
- [x] Simple StemMixerCompact quick mute on hero (dry stems + mix_as_heard story via HELP.remixPreview)
- [x] In-app help SoT = `src/ui/lib/helpCopy.ts` (`HELP.*`); HelpPanel first-run matches Simple journey (no OfflineStub/StructureEngine jargon for noobs)
- [x] HelpPanel first-run open once (`dnb-help-seen-v1`); closes after dismiss or first Generate; Why ~174 line in panel
- [x] HelpTip bubbles portal+clamp (unit clamp tests for 390/1280)
- [x] Power Mode user-facing OfflineStub/hard-grid softened to browser sketch / song layout ~174 (App badges/footer/tagline — no hard-grid-v0 / OfflineStub chrome)
- [x] docs/SCREENSHOTS.md Simple journey mindset + sign-off sheet
- [x] Docs knowledge: `docs/NOOB_GUIDE.md`, `docs/FIRST_RUN.md`, `docs/GLOSSARY.md`, `docs/ux-helptip-copy.md` (mirror)
- [x] Surprise Me under More (allowlisted templates + HELP.surpriseMe) — not a 4th primary
- [x] Favorites UI under More (FavoritesPanel + browser-local storage; HELP.favorites*)
- [ ] Tauri desktop shell smoke (src-tauri scaffold in-tree; keep unchecked until real desktop smoke; browser Sketch still primary; no ACE live; P1 after boot: FS export + Sketch 16|24-bit)
- [ ] Live CUDA sidecar /health+/probe on RTX 5080
- [ ] Real ACE-Step inference / LEGO stems
- [ ] Real LoRA train with passed memorization review
- [x] Manual browser Generate→Play→Export click-through (QA P0 on :5173 ALL GREEN 2026-09-06 PT; artifact: `~/Downloads/offline_stub_sketch_17400_export*.zip` with mix_as_heard + `offline_stub_heard_17400.wav`; offline-stub · 174 BPM · gpuUsed false — not the vitest_sample ZIP)

## Simple Mode journey (verified in UI wiring)

Style Ref (optional, owner-gated) → Generate → Play → stem tweak (optional) → Again/Vary (optional) → Export (`mix_as_heard` when remixed).

- [x] ≤3 clicks Generate→Play→Export with no tweaks / no upload
- [x] Stem mute does not require Generate again
- [x] Remixed Export adds mix_as_heard; clean Export omits it (vitest mix-as-heard)

## Provisional accuracy (automated where noted)

| ID | Gate | Status |
|----|------|--------|
| A1 | BPM lock measured within 174 +/- 2 | partial — OfflineStub forces structure BPM/samplesPerBar to 174 when far off; no audio onset/BPM meter yet |
| A2 | Seed identical StructureMap | [x] vitest |
| A3 | stem-v0 schema | [x] vitest `stem-perc-a3.test.ts` — OfflineStub exports `perc` StemId+WAV **only if perc hits > 0** (no silent `perc.wav`; role may exist empty); elemental mixer/remix; drums bus note in manifest; kick/snare/hats/bass/drums/mix intact (soft-pass forbidden) |
| A4 | no forbidden GPL/AGPL/NC in binary | policy in THIRD_PARTY; not a license scanner yet |
| A5 | no artist clone product | [x] pass-through style descriptors (vitest no-scrub); blocklist empty; still forbid catalog rips / stem RE / clone features — soft-pass forbidden on “names scrubbed” UI |
| A6 | Tone not synth engine | [x] by architecture + PreviewPlayer |
| A7 | drop energy vs intro | [x] vitest `section-energy.test.ts` — OfflineStub mix+kick drop RMS ≥ intro × 1.25 (energyCurve gains; soft-pass forbidden) |
| A13 | kick/snare median |onset−grid| ≤15ms @48kHz | [x] vitest `onset-grid.test.ts` (onsetEnvelope + OfflineStub hard-grid-v0 @174) |


## Live vs regen (Audio definition — keep honest)

| Control | Audible when | Notes |
|---------|--------------|--------|
| Mute / solo / gain | **Live mid-play** (no Generate) | Tone.Channels on cached stems (not remux-on-Play); Export still remux+glue → `mix_as_heard` when dirty |
| Energy / darkness / chaos / BPM / bars / style text / seed | **Next Generate only** | Not live; Again/Vary/Regen to hear |
| ACE mute/solo (until LEGO) | **Does not isolate** real stems | Stem lanes share ACE mix — warn, don’t fake (Sketch path for true stem remix) |

## ACE vs Sketch (do not soft-pass)

- [x] Sketch (OfflineStub) = default until probe `hasGpu: true` — real elemental stems
- [ ] Live CUDA / ACE Generate on Wyatt 5080 — **unchecked until Wyatt proves** via `INSTALL-AND-RUN.ps1`
- [ ] LEGO extract/repaint (true ACE stem isolation)
- ACE stem-share honesty must stay in UI/docs until LEGO lands

## GPU leftovers (do not soft-pass)

- ACE-Step weights + FastAPI sidecar on 5080
- CUDA probe true path
- LEGO extract/repaint + drift align
- LoRA train + memorization passed
- 24-bit encode in sidecar
- Sketch 16|24-bit export choice — wired in browser (store exportBitDepth + ensureWavBitDepth); Tauri FS export still open; not gated on Studio GPU; soft-pass forbidden
- Optional SA3 texture (attribution required)

## Knowledge / user docs

- [x] docs/GLOSSARY.md + docs/FIRST_RUN.md + docs/NOOB_GUIDE.md (teaching aligned with HELP/HelpPanel)
- [x] docs/ux-helptip-copy.md mirror of helpCopy.ts
- [x] docs/knowledge/* feature pages
- [ ] HelpTip densify: every interactive control has HELP key (Builder owns wire; #46–51 wired in cycle-7)

### Knowledge sync (Brainstormer)

- [x] docs/GLOSSARY.md mirrors GLOSSARY_BLURBS + HELP glossaryStem/Seed/why174
- [x] docs/FIRST_RUN.md 3 beats match HelpPanel + coach
- [x] docs/WHY_174.md matches HELP.why174
- [x] In-app glossary UI drawer (HelpPanel Quick glossary — GLOSSARY_BLURBS)
- [x] HELP tips use What/When/What happens; docs HelpPanel/FIRST_RUN/GLOSSARY re-synced
- [x] cycle-7 HelpPanel/HelpTip/stemMute/SCREENSHOTS sync (Builder)
- [x] cycle-7 Power footer/badge plain English; toast ≤3; Why-174 details; #57 ?/H help hotkey; retailLabels (no OfflineStub/hard-grid-v0 in chrome)

### Brainstormer #40–45 (listen UX)

- [x] #40 Waveform seek scrub (`HELP.waveformSeek` + PreviewPlayer.seek + Waveform pointer; vitest waveform-seek)
- [x] #41 Section jump chips (`HELP.sectionJump` + SectionJumpChips on Waveform)
- [x] #42 Mixer undo (`HELP.mixerUndo` + StemMixer undo; store mixerUndoAvailable)
- [x] #43 First-Play coach (`HELP.firstPlayCoach` + TransportBar + firstPlayCoach ls)
- [x] #44 Export success honesty (`exportStems` success toast ~6s: remixed→includes mix_as_heard / else dry stems+mix; `HELP.exportDone` on TransportBar Export after exported)
- [x] #45 Seed copy (`HELP.seedCopy` + ParamPanel HelpTip)
- [x] docs/ux-helptip-copy.md regenerated for #40–45 keys

### Brainstormer #46–51

- [x] #46 Stem solo hotkeys 1–4 (`HELP.stemSoloHotkeys` + `useTransportHotkeys`; invent-46-51 typing ignore)
- [x] #47 Hold-B A/B flashback (`HELP.holdBFlashback` + previousResult stash + holdB handlers)
- [x] #48 Waveform loop region (`HELP.waveformLoop` + PreviewPlayer.setLoop + Waveform drag; Esc clears)
- [x] #49 Post-Play favorites nudge (`HELP.favoritesNudge` + FavoritesNudge on TransportBar)
- [x] #50 R/V Again/Vary hotkeys (`HELP.againVaryHotkeys` + useTransportHotkeys)
- [x] #51 Soft peak warn on Export (`exportStems` scans mix/asHeard via `wavPcmPeakAbs`; if ≥ `EXPORT_HOT_PEAK` non-blocking warn toast — Export still runs; `HELP.peakWarnExport` exists — toast body currently hardcoded)
- [x] docs/ux-helptip-copy.md regenerated for #46–51

### Brainstormer #52–63

- [x] #52 Bar:beat + section readout (`HELP.barBeatReadout` + Waveform)
- [x] #53 ±1 bar nudge (`HELP.barNudge` + Waveform ‹ › + `,`/`.` hotkeys)
- [x] #54 Heard remix badge (`HELP.heardBadge` + TransportBar)
- [x] #55 Resume last seed+knobs (`HELP.resumeDraft` + ResumeDraftStrip; no audio blobs)
- [x] #56 Mixer announce (sr-only / polite `mixerAnnounce` on StemMixer — no dedicated HELP tip by design)
- [x] #57 Help hotkey (`HELP.helpHotkey` + ?/H + HelpPanel)
- [x] #58 Waveform hover time (`HELP.waveformHoverTime` + Waveform)
- [x] #59 Section dblclick loop (`HELP.sectionLoop` + SectionJumpChips)
- [x] #60 Restore previous sketch (`HELP.restorePrevious` + TransportBar Previous)
- [x] #61 Favorites empty Surprise CTA (`HELP.favoritesEmpty` + FavoritesPanel)
- [x] #62 Shift+1–4 mute (`HELP.stemMuteHotkeys` + useTransportHotkeys)
- [x] #63 Export name preview (`HELP.exportNamePreview` + export start toast with zip name)
- [x] docs/ux-helptip-copy.md regenerated through #63
- [ ] #64–69 — in tree; **hold ticks until QA re-test GREEN** (listen hotkeys/StemMixer) — then regen helptip + ACCEPTANCE
- [ ] Listen/polish invent **#76–81** (+ queued **#88–93**) — Brainstormer; do **not** checklist invent under Critic product **#70–75**; tick only after QA-green when landed
