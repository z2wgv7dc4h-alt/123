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

## Gotchas (each one caused real bad output here)

| Gotcha | Evidence | Rule |
|---|---|---|
| **Instrumental only when lyrics are exactly `[Instrumental]` or `[inst]`** | `acestep/api/server_utils.py:135-143` | Section tags like `[Intro]\n[Drop]` make ACE plan a vocal song → gibberish. Send `[Instrumental]`. |
| **Caption rewrite runs even with thinking off** | `acestep/inference.py:653-655`: LM runs if `thinking` or any `use_cot_*`; `use_cot_caption` defaults **true** | Always send `use_cot_caption: false` and `use_cot_language: false`, or the LM replaces our caption with prose. |
| **Unknown `model` silently falls back** | Log: `Model 'X' not found in [...], using primary` | The bridge sends ACE's loaded model (`GET /v1/models`). |
| **Turbo ignores CFG and caps steps** | Log: `overriding guidance_scale 7.0 -> 1.0`, `infer_steps 64 exceeds maximum 8` | Turbo: 8 steps, no ADG. |
| **Duplicate bridges on one port** | Python `HTTPServer` sets `SO_REUSEADDR`; on Windows 3 bridges bound 8766 and a stale one answered | `ExclusiveBridgeServer.allow_reuse_address = False`; the start script kills stale processes. |
| **Models lazy-load** | Log: `First request received — lazy-loading models` | The first render takes ~40 s extra. |
| **Cover / repaint / extract skip the LM** | `docs/en/INFERENCE.md` §thinking | Thinking is irrelevant there. |
| **Repaint past the end extends** | `acestep/core/generation/handler/padding_utils.py:47-58` pads silence for `repainting_end` > source length (and `repainting_start` < 0) | R-1 / R-2 "Extend" uses this. |
| **Lego / extract / complete are base-only** | README table | Needs base loaded in a second slot (`ACESTEP_CONFIG_PATH2`). |

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
