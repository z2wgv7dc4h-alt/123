# DnB Studio - full ACE stack setup (RTX 5080)
# Run once in PowerShell:  powershell -ExecutionPolicy Bypass -File setup-ace-full.ps1
$ErrorActionPreference = "Stop"
Write-Host "=== DnB Studio ACE full setup ===" -ForegroundColor Cyan

# uv
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Write-Host "Installing uv..."
  powershell -ExecutionPolicy Bypass -c "irm https://astral.sh/uv/install.ps1 | iex"
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine")
}

$aceRoot = Join-Path $env:USERPROFILE "Documents\ACE-Step-1.5"
if (-not (Test-Path $aceRoot)) {
  Write-Host "Cloning ACE-Step-1.5..."
  git clone https://github.com/ACE-Step/ACE-Step-1.5.git $aceRoot
} else {
  Write-Host "ACE repo already at $aceRoot"
}

Push-Location $aceRoot
Write-Host "uv sync (deps + CUDA torch) - first run can take a while..."
uv sync
Pop-Location

Write-Host ""
Write-Host "Setup done. Next:" -ForegroundColor Green
Write-Host "  1) powershell -ExecutionPolicy Bypass -File scripts\windows\start-ace-stack.ps1"
Write-Host "  2) In dnb-studio: npm i && npm run dev"
Write-Host "  3) Generate - should show Studio ACE (GPU) when probe is green"
Write-Host "First ACE launch downloads ~10GB models."
