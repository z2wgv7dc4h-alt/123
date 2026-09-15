# Critic + Audio must-fixes — cycle 4

> **Status update (2026-09-13 PT):** A7 is **passed** — `src/test/section-energy.test.ts` (OfflineStub mix+kick drop RMS ≥ intro × 1.25). A3 is **passed** — `src/test/stem-perc-a3.test.ts` (perc StemId+WAV + elemental mixer/remix). Rows below that say A3/A7 missing are historical.


**Date:** 2026-09-06 (PT / Australia·Perth)  
**Scope:** Adversarial review of Generate→Play→Export + Style Ref + OfflineStub audio path.  
**Mode:** Soft-pass **forbidden**. Cite real files only. Do **not** invent that gates pass.  
**Constraint:** Read-only on `src/` this cycle (Builder may be shipping UX). This doc is the Builder handoff.

Vitest at review time: **47/47 green** — green ≠ product-ready. Several assertions are soft or miss Phase-0 audio gates entirely.

---

## Verdict (honest)

| Gate | Status | Notes |
|------|--------|--------|
| Code path Generate → Play → Export | **Partial** | Wired in `useStudioStore.ts` + `TransportBar` / export helpers; `docs/ACCEPTANCE.md` still unchecked for manual click-through |
| OfflineStub real 48 kHz / 16-bit WAV | **Present** | `OfflineStubBackend.ts` + `wav.ts`; header smoke in tests |
| BPM hard-grid 174 honesty | **Soft / leaky** | Store generate always sends `DEFAULT_BPM`; OfflineStub only rewrites when `\|bpm−174\| > 2` (so 172 stays 172); Power UI BPM is cosmetic |
| Preview vs dry export | **Gap** | Default Play = glued mix; mute/solo/gain remix = raw elementals **without** mix-bus glue; export ZIP never applies mixer gains (documented) but remix preview ≠ export mix |
| Style Ref / Vibe Mirror | **Partial** | Local File-only + provenance OK; bias mostly gain/tanh; `nudgeBpmTowardReference` unused by store (good) but still a tempo-nudge API |
| Loudness / true-peak honesty | **Fail** | Schema field `truePeakDbTP` filled with **sample peak**; no integrated LUFS; glue targets ~−12 dBFS RMS (sample) only |
| Onset ≤15 ms median kick/snare | **Missing** | No automated gate in any `src/test/*` |
| Drop energy > intro (audio) | **Missing** | Structure `energyCurve` exists; A7 is “spot-check”; no RMS-by-section test |
| Consumer GUI bar (audio-facing) | **Blocked by UX P0s** | See `docs/ux-must-fixes-cycle-4.md` (HelpTip/fonts); audio copy mostly honest when tips work |
| ACE / GPU path | **Fail-soft stub** | `AceStepBackend.render` throws; Wyatt 5080 sidecar not live |

**Overall:** Do **not** soft-pass Phase 0 audio DoD. Ship Builder fixes below before claiming club-sketch / Generate→Play→Export proven.

---

## Legal boundary (must keep)

Citations: `THIRD_PARTY_NOTICES.md`, `docs/ARCHITECTURE.md`, `README.md`, `src/core/prompt/scrubArtistNames.ts`, `ARTIST_NAME_BLOCKLIST` in `src/core/types/index.ts`, style-ref File-only path in `src/core/styleRef/*`.

**Forbidden (no exceptions for “reference” tooling):**

- Reverse-engineering closed models / copyrighted catalogs
- YouTube / URL / catalog fetch for style or train
- Artist-name / Pendulum-style clone UI or prompts (scrub + blocklist only)
- Matchering / Pedalboard (GPL-3) in binary
- ACE-Step-DAW / Strudel (AGPL)
- MusicGen NC / LeVo2 non-commercial cores
- Training on third-party commercial catalogs

**Allowed:** User-owned MP3/WAV/FLAC via browser File / drag-drop; Vibe Mirror local analysis; OfflineStub original sketch; future ACE-Step 1.5 MIT sidecar on Wyatt’s machine.

Style Ref must remain: **Inspired by YOUR file — original OfflineStub output**, `acePathActive: false` for OfflineStub (`src/core/export/manifest.ts`).

---

## P0 — must-fix before “audio Phase 0 pass”

### P0.1 — Rename / dual-write peak metrics (honesty)

**Files:** `src/core/types/index.ts` (`StemFile.truePeakDbTP`, `ExportManifest.stems[].truePeakDbTP`), `src/core/backends/OfflineStubBackend.ts` (`samplePeakDb` → field fill ~372–382), `src/core/export/manifest.ts`

**Issue:** Field name claims true-peak (dBTP); OfflineStub fills **sample-peak dBFS** and only warns in `warnings[]`. Consumers / DAW users will trust the schema.

**Acceptance:**

- Manifest + `StemFile` expose an honest name (e.g. `samplePeakDbFS`) **or** keep legacy key with explicit `peakMetric: 'sample-peak'` and stop calling it true-peak in UI/status.
- Warning remains until inter-sample true-peak exists (no Matchering).
- Test asserts metric kind + that sample peak is finite and > −40 dBFS on non-silent mix.

**Builder order:** 1 (schema + OfflineStub + status copy).

---

### P0.2 — Hard-lock arrangement BPM to 174 (close the ±2 hole)

**Files:** `src/core/backends/OfflineStubBackend.ts` (~417–459), `src/core/structure/StructureEngine.ts` (~196), `src/ui/hooks/useStudioStore.ts` (`generate` uses `DEFAULT_BPM`; `setBpm` allows 170–176), `src/test/style-reference.test.ts` (~291–321 soft 170–176 assert)

**Issue:** Lock only triggers when `Math.abs(structure.bpm - DEFAULT_BPM) > 2`, so job BPM **172/176** plans and measures off-174. Style-ref test **soft-passes** `bpmMeasured` in 170–176. Power BPM slider does not affect generate (cosmetic / misleading).

**Acceptance:**

- OfflineStub always plans/renders at `DEFAULT_BPM` (174) unless explicitly documenting a Power “UI band” mode that also rewrites `samplesPerBar` and labels measured BPM honestly.
- Preferred: StructureEngine + OfflineStub hard-force 174; UI band is display-only (or remove Power BPM input until ACE).
- Tests: job `bpm: 172` → `bpmMeasured === 174` and `samplesPerBar === round((60/174)*4*48000)`.
- Replace soft band assert in `style-reference.test.ts`.

**Builder order:** 2.

---

### P0.3 — Preview remix must match export mix DSP (glue / sidechain honesty)

**Files:** `src/core/audio/PreviewPlayer.ts` (`loadMixFromStems`), `src/ui/hooks/useStudioStore.ts` (`loadPreviewFromMixer`), `src/core/backends/OfflineStubBackend.ts` (`applyMixBusGlue`, `sidechainDuckBass`)

**Issue:** Flat mixer → Play uses glued `mix` stem. Any mute/solo/gain → sum of **dry elemental WAVs** with no sidechain re-apply and no mix-bus glue. User hears a different loudness/punch than Export ZIP `*_mix.wav`.

**Acceptance:**

- Either: (A) remix path re-applies the same sidechain + mix-bus glue used at render, **or** (B) remix only from a pre-glued stem set and document “preview trim only”; **or** (C) disable mute/solo/gain until parity ships and keep Play = mix only.
- Automated test: RMS / sample-peak of default mix preview buffer within tight tolerance of exported mix stem (decode both); after mute-kick remix, no silent failure and no unexpected makeup to 0.95 (already partially honest).

**Builder order:** 3 (audio fidelity; blocks consumer trust).

---

### P0.4 — Add onset timing gate (kick/snare ≤ 15 ms median)

**Files:** new helper under `src/core/audio/` or `src/test/` util; `src/core/backends/OfflineStubBackend.ts` (hit placement via `beatToSample`); `src/test/honesty.test.ts` or new `onset-grid.test.ts`

**Issue:** Phase-0 checklist requires onset ≤ 15 ms median for kick/snare vs grid. **No test** measures audio onsets against `structure.drums` hit times. Structure plans beats; synth write starts at sample index — envelope attack is short but unverified.

**Acceptance:**

- Deterministic fixture render (fixed seed) → detect kick/snare onsets on stem buffers → median |onset − expected| ≤ 15 ms @ 48 kHz.
- Fail the suite if median exceeds threshold (no soft `toBeLessThan(50)`).

**Builder order:** 4.

---

### P0.5 — Section energy audio gate (drop > intro)

**Files:** `OfflineStubBackend.ts` (`applyEnergyCurveGains`, `sampleEnergyCurve`), `StructureEngine.ts` (`energyCurve`), `docs/ACCEPTANCE.md` A7, tests

**Issue:** Energy curve drives gains, but acceptance A7 is “spot-check”. No RMS comparison of drop vs intro windows on mix/kick.

**Acceptance:**

- Vitest: same seed → intro-bar RMS < drop-bar RMS on mix (and preferably kick) by a minimum ratio (e.g. drop ≥ intro × 1.25) using structure section bounds.
- Update ACCEPTANCE A7 to checked only after the test exists.

**Builder order:** 5.

---

## P1 — next audio cycle

### P1.1 — Export ZIP byte integrity + stem schema completeness

**Files:** `src/core/export/zip.ts`, `download.ts`, `OfflineStubBackend.ts` (~578–605), `src/test/zip.test.ts`, `render-sample.test.ts`

**Gaps:**

- ZIP tests only check `PK` magic — not CRC round-trip of stem bytes vs source blobs.
- Perc hits are rendered into mix/drums but **no `perc` StemId / WAV**; MIDI has perc (`exportMidi.ts`). Schema `stem-v0` incomplete vs drums roles.
- `drums` bus is `0.85 * sum(kick+snare+hats+perc)` — not equal to summing exported elementals; document or fix.

**Acceptance:** Round-trip CRC of each ZIP entry; either export `perc.wav` or document “perc baked into drums/mix only” in manifest; drums bus formula documented in manifest note.

### P1.2 — Loudness honesty (no GPL Matchering)

**Files:** `OfflineStubBackend.ts` (`applyMixBusGlue`), types/manifest

**Issue:** Makeup toward RMS ≈ −12 dBFS; no integrated LUFS / LRA; crest “10–12 dB” claim unverified.

**Acceptance:** Manifest fields `mixSamplePeakDbFS`, `mixRmsDbFS` (and optional rough LUFS estimate **only** if MIT-clean math, not Pedalboard/Matchering). Test: mix sample peak ∈ (−1.5 dBFS, −0.1 dBFS] soft-ceiling band; RMS not crushed < −20 dBFS for high-energy seeds.

### P1.3 — Seed reproducibility of **audio**, not only StructureMap

**Files:** `honesty.test.ts` (structure JSON only), OfflineStub

**Acceptance:** Same seed + params → identical mix WAV bytes (or identical float checksum before encode). Today only StructureMap JSON is asserted.

### P1.4 — Style-ref bias must be more than gain (still original)

**Files:** `OfflineStubBackend.ts` (~509–534), `vibeMirror.ts`, `style-reference.test.ts`

**Issue:** Bias is mostly per-stem gain + tanh; brightness/darkness help but “meaningful feel” is weak. Test only checks `waveformPeaks` inequality (easy soft pass).

**Acceptance:** With fixed seed, high-brightness vs high-darkness refs change bass character and/or hat air measurably (e.g. spectral proxy / bass character field in structure) **without** tempo-cloning or ACE claims; keep provenance `acePathActive: false`.

### P1.5 — Dead / misleading Power BPM + `nudgeBpmTowardReference`

**Files:** `useStudioStore.ts`, `analyzeAudio.ts` (`nudgeBpmTowardReference`, `STYLE_BPM_BAND`), `ParamPanel.tsx`

**Acceptance:** Either wire Power BPM into render with hard 174 lock messaging fixed, or remove/disable control; ensure store never calls `nudgeBpmTowardReference` for arrangement (card-only estimated BPM).

### P1.6 — Manual Generate→Play→Export click-through

**Files:** `docs/ACCEPTANCE.md` unchecked item

**Acceptance:** Recorded pass on CPU OfflineStub in browser (screenshot or short notes in SCREENSHOTS.md). Code-complete ≠ proven.

---

## P2 — polish / later

| ID | Item | Files |
|----|------|-------|
| P2.1 | 24-bit encode path audit (`floatTo24` negative packing) before offering 24-bit in UI | `wav.ts` |
| P2.2 | Inter-sample true-peak meter (MIT-clean only; **never** Matchering) | OfflineStub / sidecar |
| P2.3 | ACE sidecar `/render` + style-ref cover path on 5080 | `AceStepBackend.ts`, `sidecar/` |
| P2.4 | License scanner CI for forbidden GPL/AGPL (A4 still policy-only) | package / CI |
| P2.5 | Waveform playhead vs actual `AudioContext.currentTime` (currently BPM×bars estimate in UI) | `Waveform.tsx` |
| P2.6 | Object URL lifecycle: OfflineStub creates blob URLs per stem; ensure revoke on regenerate | OfflineStub / store |

---

## Test suite soft-pass / missing gates

Skim of `src/test/` (47 passing — **not** a free pass):

| File | Soft / gap |
|------|------------|
| `honesty.test.ts` | BPM lock only for `bpm: 120` (far off); no near-band 172 case; no onset; no audio seed equality; ZIP only PK magic |
| `polish.test.ts` | `truePeakDbTP > -40` is a soft floor; no LUFS/glue crest; no preview-vs-export |
| `style-reference.test.ts` | Styled `bpmMeasured` allowed **170–176** (soft vs hard 174); BPM estimate ±4; bias ≠ peaks only |
| `vibe-mirror.test.ts` | Good provenance/174 without vibe; no audio onset/energy gates |
| `structure.test.ts` | Section names + MIDI/WAV smoke only |
| `zip.test.ts` | Magic bytes only — no entry CRC / stem presence |
| `render-sample.test.ts` | Smoke write to `exports/`; not a gate suite |

**Missing dedicated tests (must add with P0.4–P0.5 / P1):**

- Onset ≤ 15 ms median kick/snare  
- Drop RMS > intro RMS  
- Preview mix buffer ≈ export mix WAV  
- ZIP CRC round-trip  
- `job.bpm = 172` → measured 174  
- Metric field honesty (`samplePeak` vs true-peak)  
- Remix without loudness makeup (partially present in PreviewPlayer comments; not asserted)

---

## Builder order (recommended)

1. **P0.1** peak metric honesty (schema + fill + UI status)  
2. **P0.2** hard 174 lock + kill soft band tests  
3. **P0.3** preview remix DSP parity with export mix  
4. **P0.4** onset ≤ 15 ms automated gate  
5. **P0.5** drop > intro RMS gate + ACCEPTANCE A7  
6. **P1.1** ZIP CRC + perc/drums schema honesty  
7. **P1.2–P1.5** loudness fields, audio seed equality, style bias strength, BPM UI cleanup  
8. **P1.6** manual click-through  
9. **P2.*** when GPU / polish window opens  

Coordinate with UX cycle-4 (`docs/ux-must-fixes-cycle-4.md`) so HelpTips/fonts land without touching audio DSP in the same conflicting PR if Builder is mid-UX.

---

## Wyatt-only blockers (not Builder-fixable alone)

1. **RTX 5080 + CUDA ACE-Step sidecar** — real inference / LEGO stems / LoRA train (`AceStepBackend`, `scripts/download-ace-step.md`, `sidecar/README.md`). Browser stays OfflineStub until `/probe` returns `hasGpu: true`.  
2. **Cursor Pro / Cloud Agents / Origin** — GitHub push to `z2wgv7dc4h-alt/Ww` deferred until account/Pro fixed (project memory).  
3. **Credentials / rights-cleared corpora** — LoRA packs remain `stub` until owner attestation + memorization review on user-owned material.  
4. **Manual taste A/B** — “club-sketch usable after 30–60 min DAW polish” still needs Wyatt listen; Critic cannot soft-pass that.

---

## What Critic is **not** claiming

- That Generate→Play→Export is fully proven in-browser this cycle.  
- That OfflineStub equals ACE production timbre.  
- That `truePeakDbTP` is true-peak.  
- That 170–176 UI band is the same as a hard 174 grid.  
- That mute/solo preview equals the exported mix.  
- That green vitest means Phase 0 audio DoD.

