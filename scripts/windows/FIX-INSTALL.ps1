# Overwrite INSTALL-AND-RUN.ps1 with ASCII-safe content (paste-run from dnb-studio root)
$ErrorActionPreference = "Stop"
$dest = Join-Path $PSScriptRoot "INSTALL-AND-RUN.ps1"
@'
# DnB Studio - ONE script: install ACE + start stack + launch app
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "DnB Studio - ACE install and run"

function Wait-Url($url, $timeoutSec, $label) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
        Write-Host "OK  $label" -ForegroundColor Green
        return $true
      }
    } catch { }
    Write-Host "... waiting for $label" -ForegroundColor DarkGray
    Start-Sleep -Seconds 3
  }
  return $false
}

function Wait-ProbeGpu($timeoutSec) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:8766/probe" -UseBasicParsing -TimeoutSec 3
      $j = $r.Content | ConvertFrom-Json
      if ($j.hasGpu -eq $true) {
        Write-Host "OK  Bridge hasGpu=true (Studio ACE path)" -ForegroundColor Green
        return $true
      }
      Write-Host "... bridge up but hasGpu=false (ACE still loading models?)" -ForegroundColor Yellow
    } catch {
      Write-Host "... waiting for bridge :8766" -ForegroundColor DarkGray
    }
    Start-Sleep -Seconds 4
  }
  return $false
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DnB Studio - ACE full stack"
Write-Host "  Rock-DnB vibe on your RTX 5080"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
if (-not (Test-Path (Join-Path $repoRoot "package.json"))) {
  Write-Error "Run this from the extracted dnb-studio folder (package.json missing at $repoRoot)"
}

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Write-Host "[1/5] Installing uv..."
  powershell -ExecutionPolicy Bypass -c "irm https://astral.sh/uv/install.ps1 | iex"
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + $env:Path
} else {
  Write-Host "[1/5] uv OK"
}

$aceRoot = Join-Path $env:USERPROFILE "Documents\ACE-Step-1.5"
if (-not (Test-Path $aceRoot)) {
  Write-Host "[2/5] Cloning ACE-Step-1.5 (once)..."
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git not found. Install Git for Windows, then re-run."
  }
  git clone https://github.com/ACE-Step/ACE-Step-1.5.git $aceRoot
} else {
  Write-Host "[2/5] ACE repo present"
}

$env:ACESTEP_QUANTIZATION = "false"
$env:ACESTEP_COMPILE = "false"
$env:ACESTEP_USE_FLASH_ATTENTION = "false"
if (-not $env:ACESTEP_LM_BACKEND) { $env:ACESTEP_LM_BACKEND = "pt" }
if (-not $env:ACESTEP_CONFIG_PATH) { $env:ACESTEP_CONFIG_PATH = "acestep-v15-base" }

Write-Host "[2/5] uv sync (first time can take several minutes)..."
Push-Location $aceRoot
uv sync
Pop-Location

Write-Host "[3/5] npm install (DnB Studio)..."
Push-Location $repoRoot
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "Node/npm not found. Install Node.js LTS, then re-run."
}
npm install
Pop-Location

Write-Host "[4/5] Starting ACE API on 127.0.0.1:8001 ..."
$aceProc = Start-Process -PassThru -WindowStyle Minimized -FilePath "uv" -ArgumentList @("run","acestep-api","--host","127.0.0.1","--port","8001") -WorkingDirectory $aceRoot

if (-not (Wait-Url "http://127.0.0.1:8001/health" 300 "ACE API :8001/health")) {
  Write-Host "ACE health not up yet - models may still be downloading." -ForegroundColor Yellow
}

$bridge = Join-Path $repoRoot "sidecar\ace_bridge_server.py"
$py = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $py) { Write-Error "Python not on PATH (needed for the DnB bridge)." }
$bridgeProc = Start-Process -PassThru -WindowStyle Minimized -FilePath $py.Source -ArgumentList @($bridge)
Write-Host "Bridge PID $($bridgeProc.Id)  ACE PID $($aceProc.Id)"

if (-not (Wait-ProbeGpu 180)) {
  Write-Host "hasGpu not true yet. Leave this window open." -ForegroundColor Yellow
}

Write-Host "[5/5] Launching DnB Studio (npm run dev)..."
Write-Host "When the browser opens: Hit Generate, then Play, then Export." -ForegroundColor Green

Push-Location $repoRoot
try {
  npm run dev
} finally {
  Pop-Location
  if ($bridgeProc -and -not $bridgeProc.HasExited) { Stop-Process -Id $bridgeProc.Id -Force -ErrorAction SilentlyContinue }
  if ($aceProc -and -not $aceProc.HasExited) { Stop-Process -Id $aceProc.Id -Force -ErrorAction SilentlyContinue }
}
'@ | Set-Content -Path $dest -Encoding Ascii
Write-Host "Wrote fixed script to $dest" -ForegroundColor Green
Write-Host "Now run: powershell -ExecutionPolicy Bypass -File `"$dest`""
