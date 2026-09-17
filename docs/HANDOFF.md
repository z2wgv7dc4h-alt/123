# Handoff

**Updated**: 2026-09-17. **Last code commit**: `84db6eb` (P-1 prompt v2).
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
| DiT | `acestep-v15-turbo` by default (`start-ace-stack.ps1`, bridge `DEFAULT_DIT_MODEL`). ACE README rates turbo *Very High*, SFT *High*, base *Medium*. The bridge sends ACE's loaded model and ignores the browser's `checkpointId`. |
| LM | `acestep-5Hz-lm-1.7B`, auto-selected by ACE. |
| text2music payload | `thinking: true`, `use_cot_caption: false`, `use_cot_language: false`, `lyrics` = song-map structure tags (`[Build - rising tension]`, `[Drop - explosive]` …; bridge keeps tag lines only, `[Instrumental]` fallback), `lm_cfg_scale: 2.0`, `bpm` = job tempo, duration from bars (cap 480 s). Turbo 8 steps; base/SFT 64 steps + ADG. |
| Cover (style ref) | Strength 0.55, clamped 0.35–0.7. Thinking off (ACE skips the LM for cover anyway). |
| Repaint / extend | `RenderJob.edit = {kind:'repaint', source, startSec, endSec}` (R-1); `endSec` past the source = extend. Used by the song map (R-2, A-1). |
| Caption | `buildAceCaption` (P-1): a paragraph in ACE example style — genre + energy (or section role), drums + bass, arrangement narrative from the song map, deduped extras, "polished and club-ready, with no vocals". No BPM; no guitar unless the layer is on or typed. |
| Tempo | A setting, 70–200 (`clampProductBpm`). Genres set the default: DnB 174, dubstep 140, half-time 170, jungle 165, trap 140. Default length 96 bars (cap 128). |
| Home UI | Genre row → style presets → style text → song shape → Generate / Vary → waveform + compact Play/Stop → song map → More. |
| Song map edits | **Studio take** (R-2, `6aede3d`): the selected section gets **Redo** / **Redo as…** (epic drop, build-up, breakdown, dubstep/trap/jungle/half-time switch, own words; ACE repaint of that bar range) and **+8 / +16** on the last section (repaint past the end); **Undo edit** steps back through `takeHistory` without rendering; Generate / Vary start a new take. **Sketch** keeps Expand / Repeat / ×2, which re-render the whole song. |
| Header chip | Labels the backend of the buffer you hear, not the last probe. |

**Sketch** (`OfflineStubBackend`) is the CPU fallback. It honors the tempo. Its
real break loops are cut at 174, so they switch off more than 6 BPM away.

## Running the stack

1. Run `scripts/windows/start-ace-stack.ps1` in **its own window and do not type
   into it**. When the ACE process stops, the script also stops the bridge.
2. The script kills stale ACE/bridge processes first. Without that, several
   bridges shared port 8766 and an old one answered every request (see
   ACE-NOTES "Gotchas").
3. Check `http://127.0.0.1:8766/probe`: it should show `bridgeBuild`,
   `checkpoint: acestep-v15-turbo` and `upstreamUp: true`.
4. The first Generate lazy-loads the models (about 40 s).
5. **Any bridge edit needs a stack restart.**

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
(bridge survives ACE `"N/A"` metas after repaint), P-1 `84db6eb` (paragraph captions, structure-tag lyrics, 96-bar default). User verified Redo, clearer builds, no vocals.

| # | Ticket | What |
|---|---|---|
| 1 | R-3 | Downbeat detection so the bar grid lines up with the take |
| 2 | E-1 | Arrangement editor on the take: insert, delete, duplicate, move, resize sections, extend anywhere (splice + seam repaint), undo. Absorbs R-4 and A-2. |
| 3 | A-3 | Tempo blocks: per-block BPM, reference-audio continuity, transition joins |
| 4 | UI-7 | Skin pass (after the editor settles) |
| 5 | R-5 | Mastering (matched loudness across blocks) |

Open, unscheduled: S-5 (cover strength listening A/B), `05` (extract; base-model
only), `07` (raw samples).

**Decisions waiting on the user**: LoRA (the only way to reliably match one
artist's sound; training was previously out of scope), downloading
`acestep-v15-xl-turbo` (larger, may be tight on 16 GB).

## Don't

- No agent audio renders, `render-sample` or `prove-gpu`. The user listens.
- No git history rewriting.
- Don't treat `docs/_archive_*` as law.
- No `@types/node`: use a narrow ambient `.d.ts` (see `src/core/audio/node-fs-shim.d.ts`).
- Don't trust a bridge change until `/probe` shows the new `bridgeBuild`.
