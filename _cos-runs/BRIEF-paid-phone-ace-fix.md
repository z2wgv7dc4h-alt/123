# PAID — OWN DnB Studio ACE/phone GPU path. Soft-pass forbidden. Wyatt: CoS is DONE — you fix and perfect.

## Mission
Phone Studio at http://192.168.68.55:5173/ still Generates **Sketch (CPU)** instead of **Studio ACE (GPU)** on RTX 5080. Make Generate reliably use ACE when hasGpu. Perfect the path. Wyatt listens from phone on same WiFi.

## Stack (already UP — do not reinstall/re-pull models)
- ACE API :8001 acestep-v15-base, models_initialized
- Bridge sidecar\ace_bridge_server.py on **0.0.0.0:8766** (was 127.0.0.1)
- Vite :5173 host 0.0.0.0 with proxy `/ace-bridge` → `http://127.0.0.1:8766`
- Probe via proxy works from PC: GET http://192.168.68.55:5173/ace-bridge/probe → hasGpu:true

## Recent CoS patches (verify / finish / fix if broken)
1. `vite.config.ts` — `/ace-bridge` proxy (phone must NOT call :8766 directly — firewall)
2. `AceStepBackend.ts` — `aceSidecarBase()` → `${origin}/ace-bridge`; `getAceSidecarProbeUrl/RenderUrl`; probe timeout 12s
3. `useStudioStore.ts` — re-probe ACE on every Generate; set productTier studio + ace-step-1.5 when hasGpu
4. `ace_bridge_server.py` — HOST 0.0.0.0 + CORS includes http://192.168.68.55:5173

## Product rules (CANON)
- Primary: ACE Generate→Play when hasGpu (selectBest→ace-step). Sketch only fail-soft.
- Defaults: acestep-v15-base, thinking, steps≈50, guidance≈7, shift≈3 — not turbo
- Expand keepSeed; Vary=new; live Channels GREEN; ACE stems = shared-mix honesty
- No HelpTips archaeology. Soft-pass forbidden.

## Do
1. Diagnose why phone Generate still Sketch despite proxy hasGpu (store productTier, initBackends, cached bundle, CORS, timeout, generate() branch).
2. Fix code so phone hard-refresh → Generate uses ACE (longer render, toast GPU online, result not Offline-stub).
3. Verify: curl/proxy probe; if you can, browser check. npm test / tsc if you edit src.
4. Write `_cos-runs/PAID-PHONE-ACE-FIX-RESULT.md` honest (what was wrong, what you changed, how to verify from phone).
5. Optionally leave a one-line note in `_cos-runs/CLAUDE-PHONE-BRIEF.md` for phone Claude app.

## Repo
C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio
Board http://127.0.0.1:8787/

## Out
Reinstall ACE, kill model download, HelpTips micro, paid token thrash beyond this fix, dual FCC.
