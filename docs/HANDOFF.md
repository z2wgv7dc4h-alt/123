# Handoff

**Updated**: 2026-09-17. **Last code commit**: `c9c878f` (B-2 genres).
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
| text2music payload | `thinking: true`, `use_cot_caption: false`, `use_cot_language: false`, `lyrics: "[Instrumental]"`, `lm_cfg_scale: 2.0`, `bpm` = job tempo, duration from bars. Turbo 8 steps; base/SFT 64 steps + ADG. |
| Cover (style ref) | Strength 0.55, clamped 0.35–0.7. Thinking off (ACE skips the LM for cover anyway). |
| Repaint / extend | Primitive only (R-1): `RenderJob.edit = {kind:'repaint', source, startSec, endSec}`. `endSec` past the source = extend. **No UI yet.** |
| Caption | `buildAceCaption`: genre-aware, short tags (genre, drums, bass, energy, "polished club mix"), no BPM, no guitar unless the guitar layer is on or the user typed it. |
| Tempo | A setting, 70–200 (`clampProductBpm`). Genres set the default: DnB 174, dubstep 140, half-time 170, jungle 165. |
| Home UI | Genre row → style presets → style text → song shape → Generate / Vary → waveform + compact Play/Stop → song map → More. |
| Song map edits | Expand / Repeat / ×2 on the **selected** section exist (`8d2de74`), but they still **re-render the whole song**. R-2 replaces this with edits on a kept take. |
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

| # | Ticket | What |
|---|---|---|
| 1 | R-2 | Keep a take; the selected section gets Redo / Extend via repaint; take history with undo |
| 2 | R-3 | Downbeat detection so the bar grid lines up with the take |
| 3 | R-4 | Duplicate / move sections with seam repaint |
| 4 | UI-7 | Skin pass (after the waveform and song map stop changing) |
| 5 | R-5 | Mastering stage (loudness) |

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
