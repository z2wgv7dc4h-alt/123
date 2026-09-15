# FCC GRUNT — ACE one-shot scripts: match start-ace-stack 5080 pins

Source: Researcher (verified on disk). Soft-pass forbidden. Do NOT touch zip.test.ts / helpCopy / OfflineStub / PreviewPlayer (FCC ZIP-CRC owns those if still LIVE).

## Bug
`start-ace-stack.ps1` is correct:
- ACESTEP_QUANTIZATION=false
- ACESTEP_COMPILE=false
- ACESTEP_USE_FLASH_ATTENTION=false
- ACESTEP_LM_BACKEND=pt (default if unset)
- ACESTEP_CONFIG_PATH=acestep-v15-base (default if unset)

`INSTALL-AND-RUN.ps1` + `FIX-INSTALL.ps1` wrongly set `ACESTEP_FLASH_ATTENTION=false` (wrong name) and never set LM_BACKEND / CONFIG_PATH → upstream turbo+vllm, no Lego/Extract, 5080 footguns. Docs still say FLASH_ATTENTION.

## Do
1. In `scripts/windows/INSTALL-AND-RUN.ps1` and `scripts/windows/FIX-INSTALL.ps1`: replace wrong pin with the same five as start-ace-stack (USE_FLASH_ATTENTION=false; set LM_BACKEND=pt and CONFIG_PATH=acestep-v15-base if unset, same pattern as start-ace-stack).
2. Update `docs/TRY_ACE.md` + `INSTALL.txt` to name USE_FLASH_ATTENTION + LM_BACKEND=pt + CONFIG_PATH=acestep-v15-base (not bare FLASH_ATTENTION).
3. Grep repo for leftover `ACESTEP_FLASH_ATTENTION` (wrong name) under scripts/docs/INSTALL — zero remaining except maybe historical notes.
4. Do NOT launch ACE stack / GPU install this session. Write `_cos-runs/FCC-ACE-5080-PINS-RESULT.md` with before/after snippets.

## Files ONLY
- scripts/windows/INSTALL-AND-RUN.ps1
- scripts/windows/FIX-INSTALL.ps1
- docs/TRY_ACE.md
- INSTALL.txt
Out: start-ace-stack.ps1 (reference only), src/**, zip tests.

## Also record in RESULT (do not install/pull models this session)
- PyTorch for 5080 must be **cu128** (sm_120). First model pull ~10GB+ — never kill mid-download.
- Prove on **acestep-v15-base** not xl; not turbo (quality/lego).
- Rock-DnB prove defaults (for later prove brief, not this script edit): thinking=true, steps≈50 (32–64), guidance≈7, shift=3.0.
