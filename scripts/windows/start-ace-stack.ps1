# Start ACE API (:8001) + DnB bridge (:8766)
# Keep this window open while using DnB Studio.
#
# Real stem separation (bridge POST /stems, "Split stems (Demucs)") needs
# Demucs v4 (MIT) in the same Python env the bridge runs:
#     pip install demucs
# This script does NOT auto-install it; without it /stems returns 501 with
# the install hint. GPU is used when torch reports CUDA, else CPU.
$ErrorActionPreference = "Stop"
# Kill stale ACE API / bridge processes first. Duplicates on 8766 answered with old code.
$stale = Get-CimInstance Win32_Process -Filter "Name like 'python%'" | Where-Object { $_.CommandLine -match 'ace_bridge_server|acestep' }
foreach ($p in $stale) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Host "Stopped $(@($stale).Count) stale ACE/bridge process(es)" -ForegroundColor Yellow
Start-Sleep -Seconds 2
$aceRoot = Join-Path $env:USERPROFILE "Documents\ACE-Step-1.5"
if (-not (Test-Path $aceRoot)) {
  Write-Error "ACE not found at $aceRoot - run setup-ace-full.ps1 first"
}

# Locate bridge next to this script's repo, or beside ACE
$repoSidecar = Join-Path $PSScriptRoot "..\..\sidecar\ace_bridge_server.py"
$repoSidecar = [IO.Path]::GetFullPath($repoSidecar)
$bridge = $repoSidecar
if (-not (Test-Path $bridge)) {
  $bridge = Join-Path $aceRoot "dnb_ace_bridge_server.py"
}
if (-not (Test-Path $bridge)) {
  Write-Error "ace_bridge_server.py not found. Keep this script inside dnb-studio\scripts\windows"
}


# RTX 5080 / Blackwell first-boot: avoid AffineQuantizedTensor crash + unverified FA wheels
# (PyTorch cu128 must come from ACE uv sync; these flags keep CUDA path alive.)
$env:ACESTEP_QUANTIZATION = "false"
$env:ACESTEP_COMPILE = "false"
$env:ACESTEP_USE_FLASH_ATTENTION = "false"
# huggingface-cli's deprecation notice has an emoji; without utf-8 it crashes on
# the Windows cp1252 console and the XL-turbo download would "fail" instantly.
$env:PYTHONIOENCODING = "utf-8"
if (-not $env:ACESTEP_LM_BACKEND) { $env:ACESTEP_LM_BACKEND = "pt" }
# DiT: 2B turbo is the default Studio model. Users report the 2B model sounds
# better than the 4B XL (ACE issue #1063) and it is faster on 16 GB.
# XL-turbo stays selectable by setting ACESTEP_CONFIG_PATH before this script.
if (-not $env:ACESTEP_CONFIG_PATH) { $env:ACESTEP_CONFIG_PATH = "acestep-v15-turbo" }
Write-Host "DiT checkpoint: $($env:ACESTEP_CONFIG_PATH)" -ForegroundColor Cyan

# LM: prefer the 4B LM when it is on disk and the DiT is 2B (a 4B DiT pairs with
# its own LM path if the user set ACESTEP_LM_MODEL_PATH). Otherwise 1.7B.
if (-not $env:ACESTEP_LM_MODEL_PATH) {
  $lm4bDir = Join-Path $aceRoot "checkpoints\acestep-5Hz-lm-4B"
  if (($env:ACESTEP_CONFIG_PATH -notmatch "xl") -and (Test-Path $lm4bDir)) {
    $env:ACESTEP_LM_MODEL_PATH = "acestep-5Hz-lm-4B"
  } else {
    $env:ACESTEP_LM_MODEL_PATH = "acestep-5Hz-lm-1.7B"
  }
}
Write-Host "LM checkpoint: $($env:ACESTEP_LM_MODEL_PATH)" -ForegroundColor Cyan
Write-Host "Starting ACE API on 127.0.0.1:8001 ..." -ForegroundColor Cyan
$ace = Start-Process -PassThru -NoNewWindow -FilePath "uv" -ArgumentList @("run","acestep-api","--host","127.0.0.1","--port","8001") -WorkingDirectory $aceRoot

Start-Sleep -Seconds 5
Write-Host "Starting DnB bridge on 127.0.0.1:8766 ..." -ForegroundColor Cyan
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $py) { Write-Error "python not on PATH" }
$bridgeProc = Start-Process -PassThru -NoNewWindow -FilePath $py.Source -ArgumentList @($bridge)

Write-Host ""
Write-Host "Stack up:" -ForegroundColor Green
Write-Host "  ACE API  http://127.0.0.1:8001/health"
Write-Host "  Bridge   http://127.0.0.1:8766/probe  (expect hasGpu:true once ACE is ready)"
Write-Host "  Then: npm run dev ? Generate"
Write-Host "Ctrl+C stops this helper; also stop child processes if needed."
Write-Host "ACE PID=$($ace.Id)  Bridge PID=$($bridgeProc.Id)"

try {
  Wait-Process -Id $ace.Id
} finally {
  if ($bridgeProc -and -not $bridgeProc.HasExited) { Stop-Process -Id $bridgeProc.Id -Force -ErrorAction SilentlyContinue }
  if ($ace -and -not $ace.HasExited) { Stop-Process -Id $ace.Id -Force -ErrorAction SilentlyContinue }
}
