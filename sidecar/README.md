# ACE-Step GPU sidecar (RTX 5080 path)

**Full stack (landed):** official ACE-Step 1.5 API on `127.0.0.1:8001` + DnB bridge on `127.0.0.1:8766` + Vite app. See **`docs/TRY_ACE.md`** and `scripts/windows/*.ps1`.

CUDA stays **off** the browser bundle. The browser talks only to the DnB contract (`/health` · `/probe` · `/render`). The bridge adapts ACE upstream `release_task` / `query_result` / `/v1/audio`.

## Local hardware target
- GPU: NVIDIA GeForce **RTX 5080**
- Device hint: `cuda:0`
- Bind: **`127.0.0.1` only** — never `0.0.0.0`
- Bridge: `http://127.0.0.1:8766`
- ACE API: `http://127.0.0.1:8001`

## Role split (non-negotiable)
| Layer | Where |
|-------|--------|
| Structure / 174 BPM grid / MIDI | Browser `HardGridStructureEngine` (`hard-grid-v0`) |
| Timbre / mix | ACE-Step via bridge (`AceStepBackend.render` → `mixWavBase64` → StemFile blobs) |
| Preview | Browser Tone/WAV of rendered mix |

`POST /render` is **audio-only**. `structureRef` is a timing hint only — sidecar must **not** invent arrangement/MIDI. Stem lanes may share the ACE mix until LEGO/extract ships (honest warnings in response).

## Preferred checkpoints
1. `acestep-v15-base` — default quality path  
2. `acestep-v15-xl-base` — higher capacity when VRAM allows  

Models auto-download on first ACE run. Do not auto-pull multi-GB weights on shared boxes.

## Local try path (full stack — not Gradio-primary)

```powershell
# one-time
powershell -ExecutionPolicy Bypass -File scripts\windows\setup-ace-full.ps1

# every session — Terminal A
powershell -ExecutionPolicy Bypass -File scripts\windows\start-ace-stack.ps1
# waits until http://127.0.0.1:8766/probe → hasGpu:true

# Terminal B
npm run dev
```

Generate → Studio ACE when probe is green. Legal: original energetic rock-DnB vibe — **no artist clones**, no catalog/YouTube rips, no AGPL DAW / Matchering / Pedalboard. See `THIRD_PARTY_NOTICES.md`.

## Contract (bridge implements)

### `GET /health`
Liveness. Does not require torch in the bridge process.

### `GET /probe`
`hasGpu: true` when ACE `:8001` is up (and/or local CUDA/nvidia visible). Browser: `AceStepBackend.probe()` → `http://127.0.0.1:8766/probe` (~800ms). Fail-soft `hasGpu: false` → `OfflineStubBackend`.

### `POST /render`
Forwards to ACE `release_task` + polls `query_result` + downloads `/v1/audio`. Returns DnB JSON with **`mixWavBase64`** (and placeholder stem lanes sharing mix until extract). **503** if ACE upstream is down.

```bash
curl -s http://127.0.0.1:8766/health
curl -s http://127.0.0.1:8766/probe
curl -s -X POST http://127.0.0.1:8766/render \
  -H 'Content-Type: application/json' \
  -d '{"jobId":"t","seed":1,"bpm":174,"durationBars":16,"prompt":{"text":"energetic rock drum and bass instrumental"}}'
```

## Processes

| File | Role |
|------|------|
| `sidecar/ace_bridge_server.py` | **Production try path** — bridge to ACE `:8001` |
| `sidecar/stub_server.py` | Docs/curl shape only (`hasGpu: false`, `/render` → 503) |
| Official `acestep-api` | GPU worker on `:8001` (cloned by setup script) |

```bash
python sidecar/ace_bridge_server.py   # after ACE API is up
# optional shape-only:
python sidecar/stub_server.py
```

## Browser fail-soft
Until `/probe` → `hasGpu: true`, registry keeps **OfflineStubBackend** (CPU sketch). OfflineStub must **never** be labeled Studio ACE quality.

## Legal
- ACE-Step 1.5 **MIT** — allowed  
- Forbidden: ACE-Step-DAW / Strudel (AGPL), Matchering / Pedalboard (GPL-3), MusicGen NC, YouTube/catalog rips, artist-clone UI  

## Status
Bridge + `AceStepBackend.render` + Windows setup/start scripts + `docs/TRY_ACE.md` landed. Real audio requires the RTX 5080 running the stack locally. Soft-pass forbidden on ACE without live probe.
