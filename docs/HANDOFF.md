# Handoff

**Updated**: 2026-09-18. **Last code commit**: `b9a16be` (UI-7 finish — primary Generate, grouped More).
Law is `AGENTS.md` + `CLAUDE.md` only. `docs/_archive_*` is not law.

Read next: `docs/ACE-NOTES.md` (what ACE really does), `docs/UI-REVAMP.md`
(editor plan), `TICKETS/` (status line at the top of each ticket).

## Workflow

- The lead (Opus) reads code, decides, and writes one implementation paste per ticket.
- The implementer (OpenCode, DeepSeek Flash) edits, runs only the tests named in
  the paste, and commits only the files named.
- Agents never render audio. The user listens and reports.
- Windows: `npm.cmd` / `npx.cmd`, never bare `npm`.

## Current state (verified by reading code on 2026-09-17)

**Studio (the real path)**: browser → bridge `sidecar/ace_bridge_server.py` :8766
→ ACE-Step 1.5 API :8001.

| Piece | State |
|---|---|
| DiT | `acestep-v15-xl-turbo` (4B) by default (`start-ace-stack.ps1`, bridge `DEFAULT_DIT_MODEL`), with CPU offload on 16 GB. ACE's non-XL family (base/SFT/turbo) is **2B**; XL-turbo is **4B** — a LoRA must match its family. The start script downloads XL-turbo on first run and falls back to plain turbo with a warning if that fails. ACE README rates turbo/xl-turbo *Very High*, SFT *High*, base *Medium*. The bridge sends ACE's loaded model and ignores the browser's `checkpointId`. |
| LM | `acestep-5Hz-lm-1.7B`, auto-selected by ACE (a 0.6B LM is also on disk); planner runs on text2music (thinking), skipped for cover/repaint. |
| text2music payload | `thinking: true`, `use_cot_caption: false`, `use_cot_language: false`, `lyrics` = song-map structure tags (`[Build - rising tension]`, `[Drop - explosive]` …; bridge keeps tag lines only, `[Instrumental]` fallback), `lm_cfg_scale: 2.0`, `bpm` = job tempo, duration from bars (cap 480 s). Turbo 8 steps; base/SFT 64 steps + ADG. |
| Style reference | User-owned file only. Default `mode: 'reference'` (`a1f0aaa`): bridge sends it as multipart `reference_audio` on text2music — timbre/mix guidance; `task_type` and thinking unchanged. `cover` mode sends `src_audio` + `audioCoverStrength` (0.55, clamped 0.35–0.7) and skips the LM. Owner attestation gates both; a repaint take may ride with a reference. UI toggle: "Sound like (reference)" / "Remake it (cover)". |
| Real stems (Demucs) | "Split stems (Demucs)" in More (`78f39d5`): bridge `POST /stems` runs Demucs v4 `htdemucs` (MIT; GPU if CUDA, else CPU) on the Studio mix and returns drums/bass/other/vocals. `AceStepBackend.separateStems` maps to drums/bass/other StemFiles; the store swaps the mirrored lanes, sets `stemsReal`, and drops the "mirror mix" warning only then. Returns 501 + `pip install demucs` hint when absent (never auto-installs). |
| Mastering | `masterStereo` (`e197b3e`, after the K-weighting fix `91ee7cb`): glue comp → gain → limiter → mid/side width → re-limit, plus a reference tone-match (1/3-octave, ±6 dB, ±3 below 60 Hz) or a gentle genre tilt. Targets: Loud −9 / **Balanced −11 (default)** / Dynamic −14 LUFS, ceiling −1 dBTP. `MasterReport` adds `matchApplied` + `maxCorrectionDb`; the JS master remains the fallback when the bridge is offline. |
| Reference window | `e197b3e` / `96e559d`: a user style file is trimmed to its loudest 45 s window (1 s-hop RMS, trailing window checked) before it is sent as `reference_audio` / cover `src_audio`; falls back to the original when short or undecodable. Edits keep their own untrimmed source. |
| Manifest / export | `4d0a17b`: the manifest stores the exact ACE request (`aceRequest`: caption, lyrics, bpm, seed, model, steps/ADG/guidance/shift, lmTemperature, sampler, repaint window, reference hash, masterTarget) plus the master report. Export ZIP contains `mix_mastered.wav`, `mix_raw.wav` (raw float, byte-for-byte), every stem (real Demucs stems when split), `manifest.json`, MIDI and sketch notes. **Recreate** in More re-renders from a loaded `manifest.json`. |
| Render progress | `4d0a17b`: the bridge records per-job progress; `GET /progress/<jobId>` returns stage (`LM planning` → `diffusion` → `decode`/`done`/`failed`) + elapsed (+ optional %). The Status card shows elapsed/stage instead of a blind spinner. |
| Real break layer (Studio) | `d5887e7`: under **drop sections only**, tiles the licensed 174 BPM breaks (amen when chaos ≥ 0.34, else two-step) aligned to the R-3 bar-grid offset, high-passed at 150 Hz, −12 dB default (More trim 0…−6 dB, `layers.realBreak` off switch), summed into the mix **before** mastering. `rawMixBlob` stays un-layered for edits; manifest gets Sketch-style `realBreakLoop` provenance. Off > ±6 BPM from 174 with a note. |
| Finish (club) | `e1e17e7`: bridge `POST /finish` runs Demucs `htdemucs_ft` → drums parallel comp (4:1, 30% blend) + transient + 1.5 dB → bass mono <120 Hz + sidechain duck <150 Hz (5/80 ms) → sum → **Matchering** to a reference when one is sent (falls back to a pedalboard chain) → loudness to the genre target (dnb −9.5, liquid −12, dubstep −7, trap −8, jungle −10; `targetLufs` override) with true peak ≤ −1 dBTP (4× oversampled). Returns 24-bit WAV + `{lufs, truePeak, crest, stagesApplied}`. Missing deps → 501 `pip install pedalboard pyloudnorm demucs`. UI: **Finish (club)** on a Studio take = new take version; raw untouched. |
| Repaint / extend | `RenderJob.edit = {kind:'repaint', source, startSec, endSec}` (R-1); `endSec` past the source = extend. Used by the song map (R-2, A-1). Bridge adds `repaint_mode` (`conservative`/`balanced`/`aggressive`, default `balanced`) and `repaint_strength` (0–1, default 0.5). |
| Caption | `buildAceCaption` (P-1): a paragraph in ACE example style — genre + energy (or section role), drums + bass, arrangement narrative from the song map, deduped extras, "polished and club-ready, with no vocals". No BPM; no guitar unless the layer is on or typed. |
| Tempo | A setting, 70–200 (`clampProductBpm`). Genres set the default: DnB 174, dubstep 140, half-time 170, jungle 165, trap 140. Default length 96 bars (cap 128). |
| Home UI | Genre row → style presets → style text → song shape → Generate / Vary → waveform + compact Play/Stop → song map → More. UI-7 `b9a16be`: Generate is a solid primary, Vary a ghost; More is a glass sheet grouped into **Export / Sound / Style reference / Mixer & stems / Advanced**; one HelpTip per component. |
| Song map edits | **Studio take** (R-2, `6aede3d`; strength + best-of-3 `7a21e57`): the selected section gets **Redo** / **Redo as…** (epic drop, build-up, breakdown, dubstep/trap/jungle/half-time switch, own words; ACE repaint of that bar range), a **Change amount** range (0.2–1, default 0.5 → `repaint_strength`), and **+8 / +16** on the last section (repaint past the end); **Undo edit** steps back through `takeHistory` without rendering. Redo asks ACE for `batchSize: 3`; the bridge returns every result file as a candidate, and **Pick 1 2 3** swaps the heard mix (new take version, no render). Generate / Vary start a new take. **Sketch** keeps Expand / Repeat / ×2, which re-render the whole song. |
| Header chip | Labels the backend of the buffer you hear, not the last probe. |

**Sketch** (`OfflineStubBackend`) is the CPU fallback. It honors the tempo. Its
real break loops are cut at 174, so they switch off more than 6 BPM away.
Studio layers the same licensed loops under drop sections (`d5887e7`) with the
same ±6 BPM gate.

## Running the stack

1. Run `scripts/windows/start-ace-stack.ps1` in **its own window and do not type
   into it**. When the ACE process stops, the script also stops the bridge.
2. The script kills stale ACE/bridge processes first. Without that, several
   bridges shared port 8766 and an old one answered every request (see
   ACE-NOTES "Gotchas").
3. Check `http://127.0.0.1:8766/probe`: it should show `bridgeBuild`,
   `checkpoint: acestep-v15-xl-turbo` and `upstreamUp: true`.
4. The first Generate lazy-loads the models (about 40 s).
5. Real stems need Demucs in the bridge Python: `pip install demucs`. The start
   script does not auto-install; `/stems` returns 501 with that hint otherwise.
6. **Any bridge edit needs a stack restart.**

### Listening set (user-run; agents never)

`npm run listen:set` renders 5 fixed prompts (dnb festival, neuro, dubstep 140,
trap 140, jungle 165) × 2 seeds through the live bridge into
`exports/listening/<date>/` — one WAV per render plus `report.csv` with
duration, integrated LUFS and sample peak. Needs the stack up and `tsx` (now a
devDependency). Override the bridge with `ACE_BRIDGE_URL`.

## Next, in order

**Product goal (user, 2026-09-17)**: diverse bass music in one track: DnB with
big builds and epic drops that can switch to dubstep or trap for a section.
ACE renders one BPM per call, so switches come in two kinds:
- **Same-tempo switch** (DnB → half-time dubstep/trap feel at 174): repaint that
  section with another genre + role caption. ACE crossfades the seams.
- **Tempo switch** (174 → 140): render a separate block at its own BPM, using
  the previous block as ACE `reference_audio` for palette continuity; join with
  a transition (riser/stop → impact → new tempo). Hard cut, no tempo ramp.

Done since: A-1 `acf9bf1` (section roles, "Redo as…", trap), FIX-1 `e55c1de`
(bridge survives ACE `"N/A"` metas after repaint), P-1 `84db6eb` (paragraph captions, structure-tag lyrics, 96-bar default), Redo strength + best-of-3 `7a21e57` (`repaint_mode`/`repaint_strength`, `batchSize` candidates, **Pick 1 2 3**), style reference via `reference_audio` `a1f0aaa` (reference/cover modes), real stems via Demucs `78f39d5` (**Split stems (Demucs)**), R-3 `4541662` (downbeat bar grid), UI-7 `7dbe475` (skin pass), R-5 `70ba5f7` (loudness master — actually applies after the K-weighting fix `91ee7cb`), listening set `522ec58` (**npm run listen:set**), E-1 `9222c20` (arrangement editor: **Duplicate / Delete / Move-by-drag / Insert blank N bars**). User verified Redo, clearer builds, no vocals. Default Studio DiT switched to ACE-Step **XL-turbo** (4B, CPU offload) `fc5f224` with a one-time download in the start script + turbo fallback.

Latest batch (since `720371c`): **45 s reference window + mastering-target presets** `e197b3e` (Balanced −11 default) and the **hardening pass** `96e559d`; **reproducible manifests + full export + render progress** `4d0a17b` (ZIP `mix_mastered.wav` / `mix_raw.wav` / real stems / `manifest.json`, **Recreate** button, `GET /progress/<jobId>`); **real break layer under Studio drops** `d5887e7`; **club Finish chain** `e1e17e7` (Demucs `htdemucs_ft` stem rebalance + pedalboard/pyloudnorm, **Matchering** when a reference is attached, genre targets, ≤ −1 dBTP); **UI-7 finish** `b9a16be` (primary Generate, grouped glass More, fewer `?`). DiT families are 2B (base/SFT/turbo) vs 4B XL-turbo; LM default is `acestep-5Hz-lm-1.7B`.

| # | Ticket | What |
|---|---|---|
| 1 | A-3 | Tempo blocks: per-block BPM, reference-audio continuity, transition joins (`reference_audio` primitive landed `a1f0aaa`) |

Open, unscheduled: S-5 (cover strength listening A/B), `05` (ACE-native
`extract` for kick/snare granularity — real stems already ship via Demucs,
S-7 `78f39d5`), `07` (raw samples).

**Decisions waiting on the user**: none blocking. LoRA landed (`50401c5`): bridge
`GET /loras` lists local adapters and `POST /lora` / `/lora/off` load, scale and
unload with a **2B-vs-XL family check** (a 2B adapter needs the 2B DiT, an XL
adapter the XL DiT) instead of producing garbage. Train on 2B turbo/base with
LoKr on 16 GB (clips, not full tracks); no public DnB LoRA as of 2026-09.

## Don't

- No agent audio renders, `render-sample` or `prove-gpu`. The user listens.
- No git history rewriting.
- Don't treat `docs/_archive_*` as law.
- No `@types/node`: use a narrow ambient `.d.ts` (see `src/core/audio/node-fs-shim.d.ts`).
- Don't trust a bridge change until `/probe` shows the new `bridgeBuild`.
