# REVIEW-SOUND

This is an honest review of why the output sounds cheap. It is based on reading
the code, not on rendering. No audio was generated for this document.

## Two backends — know which one you heard

| | Sketch | Studio |
|---|---|---|
| Backend | `OfflineStubBackend` | `AceStepBackend` → `sidecar/ace_bridge_server.py` → ACE API :8001 |
| Audio | CPU Float32Array synthesis, plus an optional real break (`buildRealBreakBus`, `layers.realBreak`, default `true`) | ACE-Step 1.5 DiT `acestep-v15-base` (the user reports its official quality rating as Medium; that label isn't in the local `ACE-Step-1.5/docs/en`) |
| Ceiling | **It will never be a master.** It is a sketch. | Limited by the checkpoint, sampler settings and caption |
| Shared | `structureEngine.plan()` only | same |

Current Studio settings (`AceStepBackend.ts:48-65`): `ACE_INFERENCE_STEPS = 50`,
`ACE_GUIDANCE_SCALE = 7.0`, `ACE_SHIFT = 3.0`, `ACE_DCW_ENABLED = true`,
`ACE_DCW_MODE = 'low'` (just wired), and `ACE_COVER_STRENGTH = 0.25`.
The caption builder (`buildAceCaption`) and the cover plumbing exist.
**The cover path has not been proven on live ACE.**

## Why it sounds cheap (evidence)

### 1. Listening to Sketch when you meant Studio, or the reverse

- `generate()` re-probes ACE on every call. If the probe answers, it silently
  switches `productTier: 'studio'` (`useStudioStore.ts:986-993`). If not, it
  falls back to `backendId: 'offline-stub'` with a toast (`:1003-1016`).
- The header chip comes from `productTier === 'studio' && aceHasGpu`
  (`App.tsx:49`), **not** from `result.backendId`. So the chip reflects the
  state after the last probe, not the audio in the buffer.
- `PowerExtras.tsx` `STUDIO_MODELS` marks `acestep-v15-turbo` as `status: 'active'`
  with the hint "what Generate uses now", but `AceStepBackend.ts:283` sends
  `checkpointId: 'acestep-v15-base'`.
- The bridge reports `checkpointId` from `os.environ.get("ACESTEP_CONFIG_PATH", ...)`
  (`ace_bridge_server.py:452`), not from the `"model"` it actually sent
  (`:399`). So the manifest can name a checkpoint that wasn't used.
- `TransportBar.tsx:348` always says `3 · Export Sketch ZIP`, even on Studio.

### 2. Base checkpoint, not SFT or turbo-rl

- The only DiT folders in `C:\Users\RIGGUSPIG\Documents\ACE-Step-1.5\checkpoints`
  are `acestep-v15-base` and `acestep-v15-turbo`. **There is no `acestep-v15-sft`
  on disk**, and no turbo-rl folder either.
- ACE's own guide (`docs/en/ace_step_musicians_guide.md:521`) says
  "SFT: 50 steps default … more detail and nuance". Base is the
  pre-fine-tune checkpoint.

### 3. 50 steps against the base-model docs

- ACE `docs/en/INFERENCE.md:366` says "Base model: 1-200 (recommended 32-64)".
  `INFERENCE.md:1015` says "Use base model with `inference_steps=64` or higher"
  for high quality.
- The comment above `ACE_INFERENCE_STEPS` says "30-60 is the documented range",
  which misquotes the docs. 50 is inside the range but below the high-quality tip.
- If `inferenceSteps` is missing, the bridge falls back to `or 32` (`ace_bridge_server.py:384`).

### 4. Generic caption

- `buildAceCaption` always starts with `'drum and bass', 'instrumental',
  'rolling breakbeats', 'sub bass'`, then band words, then `'rock-dnb crossover'`.
- The defaults are `energy: 0.75`, `darkness: 0.45`, `chaos: 0.25`
  (`useStudioStore.ts:478-480`). They choose `energyWords` → `'stadium energy,
  high-drive drop, jump up bassline'`, `darknessWords` → `'weighted bass mood,
  rolling reese bass'`, and `chaosWords` → `'tight edits, controlled fills,
  precise breakbeat chops'`.
- Then `userText` = `DEFAULT_DESCRIPTORS.slice(0, 4)` =
  `'energetic dancefloor drum and bass, rock-dnb crossover, distorted guitar
  riffs, reese bass'`. `pushDeduped` only drops phrases that are substrings of an
  existing part. So `'energetic dancefloor drum and bass'` survives, and
  **`'distorted guitar riffs'` ends up in every default caption** even with
  `layers.guitar` off.
- `useStudioStore.ts:1090-1092` appends `'half-time snare on 3, heavy
  dubstep-feel drop at 174 bpm'` to **both** `dubstep` and `half-time-drop`.
  So a half-time drop is captioned as dubstep.
- Nothing in the caption names the actual production: amen chops only appear
  in some chaos/seed variants, and there is no "snare on 2 and 4 at 174 (3 in
  half-time count)", no Reese detune/movement, and no mix language.
- The bridge also sends `"thinking": True` for text2music
  (`ace_bridge_server.py:376`), so the 5Hz LM rewrites the caption into prose.
  `sidecar/ace-stack-restart.log.err` shows generic expansions like "dynamic
  shifts between intense". This is not ticketed yet; it would be one knob after S-2.

### 5. Cover strength when a style ref is used

- `ACE_COVER_STRENGTH = 0.25` sits near ACE's "0.2 for style transfer" note
  (`INFERENCE.md:393`). ACE's own examples use 0.7–0.8.
- The bridge uses `float(req.get("audioCoverStrength") or 0.25)`
  (`ace_bridge_server.py:413`), so `0.0` can never be sent.
- The cover path sets `thinking: False` and has **never been heard on live ACE**.

### 6. Arrangement energy clamp

- `energyCurve()` in `StructureEngine.ts:443-448`:
  `dropBoost = dubstepShape ? 0.5 : halfTimeDrop ? 0.42 : 0.3`, then
  `Math.min(1, base + dropBoost)`. With the default energy of 0.75, **every
  shape's drop clamps to 1.0**, including dubstep and half-time-drop.
- `planDrums()` (`StructureEngine.ts:180-182`) uses `dropBoost = halfTimeDrop ? 0.38 : 0.25`,
  where `halfTime` is true for both shapes (`:474`). Again `Math.min(1, …)` gives 1.0.
- Scope: this affects **Sketch** gains and drum velocities, and the song-map
  energy strip. **It does not reach Studio.** `AceStepBackend` sends only
  `sections[{name, startBar, lengthBars}]` and one global `prompt.energy`.
  `energyCurve` is never sent. On Studio, the two shapes differ only by caption
  text, and (see 4) that text is the same for both.

### 7. Sketch drum and synth ceiling

- `writeKick` is a sine body plus two sine clicks. `writeSnare` is bandpassed
  noise at 1.8 kHz plus a 195 Hz triangle. `writeHat` is bandpassed noise plus
  square partials. `writeBass` is sine/saw with an LFO. The guitar layers are
  `tanh(sin)`. All of these are in `OfflineStubBackend.ts:90-452`.
- The real break (`buildRealBreakBus`) is the only recorded drum content.
- This is a deliberate ceiling. **There is no Sketch drum-synth rewrite in this pass.**

## Ranked experiments (one knob each, tickets only)

| Rank | ID | Knob | Why this rank |
|---|---|---|---|
| 1 | S-1 | Which backend and checkpoint was actually heard: label + probe, no render | Every other experiment is meaningless if we don't know what was heard |
| 2 | S-2 | Caption: concrete DnB production language; test the string | Cheapest fix with the biggest effect; removes the default guitar words and the wrong dubstep text |
| 3 | S-3 | Same seed, 50 vs 64 steps; the user listens | One constant, and the docs back it |
| 4 | S-4 | SFT checkpoint: not on disk, so a "download SFT" ticket; no download now | Probably a bigger quality jump, but needs a download and VRAM |
| 5 | S-5 | Style-ref cover strength 0.35 vs 0.7: payload test now, user listens later | Only matters when a style ref is attached, and cover is unproven live |

## Out of scope for this pass

No LoRA. No new sample packs. No Sketch drum-synth rewrite. No agent-run renders.
