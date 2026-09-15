# Download ACE-Step 1.5 weights (stub)

Not needed for Phase 0 browser builds. Download when wiring the CUDA sidecar for RTX 5080.

## Prefer base / xl-base (not turbo-only)

- acestep-v15-base — default quality path
- acestep-v15-xl-base — higher capacity when VRAM allows

## Layout
~/.cache/dnb-studio/ace-step/{acestep-v15-base,acestep-v15-xl-base}/

Pin official HF download commands later. Verify MIT license. See THIRD_PARTY_NOTICES.md.
Fail-soft: without sidecar, Sketch uses OfflineStub via selectBest().

## API note (research)
ACE-Step 1.5 upstream FastAPI may expose `release_task` / `query_result` (async queue). DnB Studio's sidecar contract is still `/health` + `/probe` + `/render` only — structure stays in-browser; `/render` is audio-only. See `sidecar/README.md`.
