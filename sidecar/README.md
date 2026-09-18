# ACE-Step GPU sidecar (RTX 5080 path)

**Full stack (landed):** official ACE-Step 1.5 API on `127.0.0.1:8001` + DnB bridge on `127.0.0.1:8766` + Vite app. See **`docs/TRY_ACE.md`** and `scripts/windows/*.ps1`.

CUDA stays **off** the browser bundle. The browser talks only to the DnB contract (`/health` · `/probe` · `/render` · `/stems`). The bridge adapts ACE upstream `release_task` / `query_result` / `/v1/audio`, and runs Demucs locally for `/stems`.

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

`POST /render` is **audio-only**. `structureRef` is a timing hint only — sidecar must **not** invent arrangement/MIDI. Stem lanes share the ACE mix; **Split stems (Demucs)** (`POST /stems`) separates real drums/bass/other (ACE-native extract is still pending, ticket `05`).

## Preferred checkpoints
1. `acestep-v15-xl-turbo` — **default** (4B, ACE README Very High, 8 steps; CPU
   offload fits 16 GB). `start-ace-stack.ps1` downloads it on first run and falls
   back to `acestep-v15-turbo` if the download fails.
2. `acestep-v15-turbo` — smaller 8-step turbo (Very High)
3. `acestep-v15-base` / `acestep-v15-sft` — 64 steps + ADG (Medium / High)

XL + offload is slower: the bridge polls up to 600 s and the browser render
timeout is 660 s. Models lazy-load on first ACE run; the start script ships the
one-time XL download (do not auto-pull multi-GB weights on shared boxes).

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

Optional uploads (multipart): `srcAudioBase64` rides as `src_audio` for cover /
repaint (`taskType`, `repaintMode`, `repaintStrength`); `refAudioBase64` rides
as `reference_audio` for text2music timbre guidance. `batchSize > 1` returns
`candidates`.

### `POST /stems`
Real stem separation via Demucs v4 `htdemucs` (GPU when CUDA, else CPU):
send `{"mixWavBase64":"..."}` and get `{stems:[{id,wavBase64,durationSec}]}` for
`drums`/`bass`/`other`/`vocals`. **501** + `installHint` when Demucs is absent
(`pip install demucs`); the bridge never auto-installs. No ACE/GPU health gate.

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
- Demucs v4 **MIT** — optional real-stem separation (`pip install demucs`)
- Personal, non-commercial project: packs/breaks already in-repo are fine. No artist-clone product; no labelling ACE extract as real isolated stems from a track we do not have.

## Status
