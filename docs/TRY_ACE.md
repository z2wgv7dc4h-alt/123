# Try ACE (Windows one-shot)

GPU Studio path on the RTX 5080. **Not** the default browser sketch.

## One script

From the extracted repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\INSTALL-AND-RUN.ps1
```

Or follow `INSTALL.txt` (same path). First run can download ~10GB of models.

## What “ready” means

- Bridge: `http://127.0.0.1:8766/probe` → `"hasGpu": true`
- Until then the app stays on the **CPU browser sketch** (OfflineStub) — fail-soft, not broken.
- When `hasGpu` is true, Generate can use **Studio ACE (GPU)**. Do **not** tick ACE/CUDA ACCEPTANCE until that live Generate is proven on the 5080.

Need: NVIDIA driver, Git, Node.js LTS, internet. RTX 5080 first boot: script sets ACESTEP_QUANTIZATION=false, ACESTEP_COMPILE=false, ACESTEP_USE_FLASH_ATTENTION=false, ACESTEP_LM_BACKEND=pt, and ACESTEP_CONFIG_PATH=acestep-v15-base.

## Honesty (CPU vs GPU)

| Path | When | What you get |
|------|------|----------------|
| **Sketch (CPU)** | Default / no GPU probe | Real separate stems; mute/solo/gain isolate parts; remixed Export can add `mix_as_heard` |
| **Studio ACE (GPU)** | `hasGpu: true` after install | Higher-quality mix; **until LEGO/extract lands, stem lanes share the ACE mix** — mute/solo won’t isolate real kick/snare/bass |

Legal: original energetic rock-DnB / dancefloor vibe — not artist clones, no catalog rips. Style Ref = files you own only.

Advanced (split terminals): `setup-ace-full.ps1` + `start-ace-stack.ps1`.

Browser-only first run (no GPU): [FIRST_RUN.md](FIRST_RUN.md).
