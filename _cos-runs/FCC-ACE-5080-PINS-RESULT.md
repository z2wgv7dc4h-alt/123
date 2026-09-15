# FCC GRUNT — ACE one-shot scripts: match start-ace-stack 5080 pins

## Summary of Changes Made

### 1. Fixed `scripts/windows/INSTALL-AND-RUN.ps1`
**Before:**
```powershell
# RTX 5080 / Blackwell: disable broken compile/flash paths on first boots
$env:ACESTEP_QUANTIZATION = "false"
$env:ACESTEP_COMPILE = "false"
$env:ACESTEP_FLASH_ATTENTION = "false"
```

**After:**
```powershell
# RTX 5080 / Blackwell: disable broken compile/flash paths on first boots
$env:ACESTEP_QUANTIZATION = "false"
$env:ACESTEP_COMPILE = "false"
$env:ACESTEP_USE_FLASH_ATTENTION = "false"
if (-not $env:ACESTEP_LM_BACKEND) { $env:ACESTEP_LM_BACKEND = "pt" }
if (-not $env:ACESTEP_CONFIG_PATH) { $env:ACESTEP_CONFIG_PATH = "acestep-v15-base" }
```

### 2. Fixed `scripts/windows/FIX-INSTALL.ps1`
**Before:**
```powershell
$env:ACESTEP_QUANTIZATION = "false"
$env:ACESTEP_COMPILE = "false"
$env:ACESTEP_FLASH_ATTENTION = "false"
```

**After:**
```powershell
$env:ACESTEP_QUANTIZATION = "false"
$env:ACESTEP_COMPILE = "false"
$env:ACESTEP_USE_FLASH_ATTENTION = "false"
if (-not $env:ACESTEP_LM_BACKEND) { $env:ACESTEP_LM_BACKEND = "pt" }
if (-not $env:ACESTEP_CONFIG_PATH) { $env:ACESTEP_CONFIG_PATH = "acestep-v15-base" }
```

### 3. Updated `docs/TRY_ACE.md`
**Before:**
```
RTX 5080 first boot: script sets ACESTEP_QUANTIZATION/COMPILE/FLASH_ATTENTION=false.
```

**After:**
```
RTX 5080 first boot: script sets ACESTEP_QUANTIZATION=false, ACESTEP_COMPILE=false, ACESTEP_USE_FLASH_ATTENTION=false, ACESTEP_LM_BACKEND=pt, and ACESTEP_CONFIG_PATH=acestep-v15-base.
```

### 4. Updated `INSTALL.txt`
**Before:**
```
RTX 5080 first boot: script sets ACESTEP_QUANTIZATION / COMPILE / FLASH_ATTENTION = false.
```

**After:**
```
RTX 5080 first boot: script sets ACESTEP_QUANTIZATION=false, ACESTEP_COMPILE=false, ACESTEP_USE_FLASH_ATTENTION=false, ACESTEP_LM_BACKEND=pt, and ACESTEP_CONFIG_PATH=acestep-v15-base.
```

## Verification
- Grep for leftover `ACESTEP_FLASH_ATTENTION` (wrong name) shows only this BRIEF file remains
- All target files now match the correct pin pattern from `start-ace-stack.ps1`
- No ACE stack was launched or GPU install performed this session as instructed

## Notes for Future Runs
- PyTorch for 5080 must be **cu128** (sm_120)
- First model pull will be ~10GB+ for `acestep-v15-base`
- Rock-DnB prove defaults (for later prove brief): thinking=true, steps≈50 (32–64), guidance≈7, shift=3.0

## Test Results
All tests passed (38 test files, 228 tests passed, 2 skipped).
TypeScript compilation check was not performed due to permission constraints in this session.