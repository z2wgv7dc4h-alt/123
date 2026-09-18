# ACE-NOTES — what ACE-Step 1.5 actually does

Checked against the installed repo at `%USERPROFILE%\Documents\ACE-Step-1.5`
on 2026-09-16/17. Paths below are relative to that repo.

## Models

From `README.md` (model tables):

| DiT | Steps | CFG | Tasks | Quality |
|---|---|---|---|---|
| `acestep-v15-base` | 50 | yes | all, incl. extract / lego / complete | Medium |
| `acestep-v15-sft` | 50 | yes | text2music, cover, repaint | High |
| `acestep-v15-turbo` | 8 | no | text2music, cover, repaint | **Very High** |
| `acestep-v15-xl-turbo` | 8 | no | text2music, cover, repaint | Very High (larger) |

**On disk**: base, turbo, LMs 0.6B and 1.7B. **Studio uses turbo.** Don't download
SFT for quality; it is rated below turbo.

## What `/release_task` honors over HTTP

`acestep/api/http/release_task_request_builder.py` parses these fields:
`prompt lyrics thinking model bpm key_scale time_signature audio_duration
vocal_language inference_steps guidance_scale use_random_seed seed batch_size
repainting_start repainting_end instruction audio_cover_strength
cover_noise_strength task_type chunk_mask_mode repaint_mode repaint_strength
use_adg cfg_interval_start cfg_interval_end infer_method shift audio_format
lm_model_path lm_backend lm_temperature lm_cfg_scale lm_top_k lm_top_p
use_cot_caption use_cot_language allow_lm_batch` (plus a few analysis fields).

**Ignored over HTTP**: all `dcw_*` fields. ACE uses the model's own DCW default
(turbo: on, `double`; non-turbo: off). Our `dcwEnabled` / `dcwMode` fields have
no effect. `use_cot_metas` is not exposed (always on outside sample mode).

**Repaint controls**: `repaint_mode` (`conservative`/`balanced`/`aggressive`) and
`repaint_strength` (0–1) tune how freely ACE rewrites the repainted window. With
`batch_size > 1` the task result lists one file per candidate; the bridge
downloads every file and returns them as `candidates`, so the browser can offer
best-of-N without re-rendering (`7a21e57`).

**Audio uploads** (multipart file fields, separate from the JSON): `src_audio`
makes ACE switch `task_type` to cover/repaint and skip the LM; `reference_audio`
guides timbre/mix while the request stays text2music with thinking on. The bridge
sends one multipart body with both when a repaint take and a reference are
attached (`a1f0aaa`).

**Real stems are Demucs, not ACE extract** (`78f39d5`): the bridge's own
`POST /stems` runs Demucs v4 `htdemucs` (MIT) on the rendered mix — GPU when
torch reports CUDA, else CPU — and returns `drums/bass/other/vocals`. It is a
separate process, so it needs `pip install demucs` in the bridge Python and
does not depend on ACE being loaded. ACE's own `extract` task (ticket `05`,
base-model only) remains the path for kick/snare-level granularity.

## Gotchas (each one caused real bad output here)

| Gotcha | Evidence | Rule |
|---|---|---|
| **`is_instrumental()` is exact-match, but its flag is not used by generation** | `acestep/api/server_utils.py:135-143` sets `GenerationParams.instrumental`; `grep "\.instrumental\b" acestep` finds no reader in the generate path (only OpenRouter/UI) | **Correction 2026-09-17:** section-tag lyrics were *not* the cause of the nonsense (the stale bridge was). Structure tags are ACE's documented timeline control — use them. Keep lyric lines out and say "instrumental, no vocals" in the caption. |
| **Caption rewrite runs even with thinking off** | `acestep/inference.py:653-655`: LM runs if `thinking` or any `use_cot_*`; `use_cot_caption` defaults **true** | Always send `use_cot_caption: false` and `use_cot_language: false`, or the LM replaces our caption with prose. |
| **Unknown `model` silently falls back** | Log: `Model 'X' not found in [...], using primary` | The bridge sends ACE's loaded model (`GET /v1/models`). |
| **Turbo ignores CFG and caps steps** | Log: `overriding guidance_scale 7.0 -> 1.0`, `infer_steps 64 exceeds maximum 8` | Turbo: 8 steps, no ADG. |
| **Duplicate bridges on one port** | Python `HTTPServer` sets `SO_REUSEADDR`; on Windows 3 bridges bound 8766 and a stale one answered | `ExclusiveBridgeServer.allow_reuse_address = False`; the start script kills stale processes. |
| **Models lazy-load** | Log: `First request received — lazy-loading models` | The first render takes ~40 s extra. |
| **Cover / repaint / extract skip the LM** | `docs/en/INFERENCE.md` §thinking | Thinking is irrelevant there. |
| **Repaint past the end extends** | `acestep/core/generation/handler/padding_utils.py:47-58` pads silence for `repainting_end` > source length (and `repainting_start` < 0) | R-1 / R-2 "Extend" uses this. |
| **Lego / extract / complete are base-only** | README table | Needs base loaded in a second slot (`ACESTEP_CONFIG_PATH2`). |

## Captions and lyrics (ACE's own guidance)

Sources: `docs/en/Tutorial.md` §"About Caption" / §"About Lyrics",
`.claude/skills/acestep-songwriting/SKILL.md`, and the 200 prompts in `examples/text2music/`.

- **Caption = a descriptive paragraph.** Every shipped example is a 60–110 word
  paragraph: genre + mood, instruments with texture/production words, then how the
  arrangement unfolds (e.g. *"A dark, atmospheric trap track driven by a deep 808
  sub-bass line and crisp, rolling hi-hats … culminating in a filtered outro"*). The
  LM's own CoT rewrite produces the same shape. Comma-tag lists are accepted but are
  not what the model mostly saw; duplicate or conflicting words degrade output.
- **Dimensions**: genre, emotion, instruments, timbre texture (warm, crisp, punchy,
  polished), era, production style, rhythm feel, structure hints ("building intro").
- **Conflicts → evolution**: to mix styles, describe them over time ("rolling drum and
  bass that switches to half-time dubstep for the second drop") instead of fusing them.
- **No BPM / key in the caption**: use the `bpm` / `keyscale` fields.
- **Lyrics = the temporal script.** Structure tags `[Intro] [Build] [Drop] [Breakdown]
  [Outro]`, instrumental tags `[Instrumental] [Instrumental Break]`, energy tags
  `[building energy] [explosive]`. Combine sparingly: `[Drop - explosive]`, never a stack
  of modifiers (the model may sing tag text).
- **Caption and lyrics must agree** (instruments ↔ instrumental tags, emotion ↔ energy tags).
- **Length**: examples run 140–240 s; "a song too short feels rushed".

## Checking what ACE actually got

Look in the ACE API window after a Generate:

- `Loading primary DiT model: ...` → which model.
- `LLM usage decision: thinking=..., use_cot_caption=...` → must say `use_cot_caption=False`.
- The `# Caption` and `# Lyric` blocks → our short tags and `[Instrumental]`, not a prose paragraph.
- No `Model '...' not found` line.

## Gradio control test (is it ACE or our app?)

1. Stop the stack.
2. In `Documents\ACE-Step-1.5`, set `ACESTEP_QUANTIZATION=false`,
   `ACESTEP_COMPILE=false`, `ACESTEP_USE_FLASH_ATTENTION=false`,
   `ACESTEP_LM_BACKEND=pt`, then run `uv run acestep`.
3. Settings: turbo, LM 1.7B, backend `pt`, **uncheck INT8 / Compile / Flash
   Attention** (the UI turns them on for 16 GB cards), then Initialize.
4. Use Custom mode, a short caption, lyrics `[Instrumental]`, bpm, duration 90, Think on.
   Gradio defaults: CaptionRewrite **off**, 8 steps, shift 3.0, LM CFG 2.0.
