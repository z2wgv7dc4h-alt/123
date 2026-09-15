# FCC GRUNT — ACE prove on Wyatt 5080 (GPU ready)

Wyatt: GPU ready (2026-09-14). Soft-pass forbidden. Pins already fixed in INSTALL-AND-RUN / FIX-INSTALL / start-ace-stack (USE_FLASH_ATTENTION, LM_BACKEND=pt, CONFIG_PATH=acestep-v15-base).

## Do
1. Use start-ace-stack.ps1 (correct pins). PyTorch must be **cu128** (sm_120). Prove on **acestep-v15-base** not xl/turbo.
2. First model pull ~10GB+ — do NOT kill mid-download.
3. Prove defaults: thinking=true, steps≈50 (32–64), guidance≈7, shift=3.0 (bump bridge if still 32).
4. Acceptance: probe hasGpu true + real WAV Play through Studio path. Write `_cos-runs/FCC-ACE-PROVE-RESULT.md` with honest pass/fail (no fake ACE claims).
5. Do not wire Retake. Do not claim true stem isolation.

## Files
scripts/windows/*ace*, bridge config if steps only, AceStepBackend only if prove path broken — document every edit.
Out: StructureEngine, useStudioStore (unless blocking), HelpTips.
