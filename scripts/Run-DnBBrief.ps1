<#
Run-DnBBrief.ps1 — headless FCC or paid Claude.
Identity: -n DnB-FCC|DnB-Paid + ACTIVE-<which>.json
FCC MUST set ANTHROPIC_BASE_URL=http://127.0.0.1:8082 (fcc-claude alone is not enough from this host).
Paid MUST clear BASE_URL/AUTH_TOKEN so subscription Sonnet is used.
#>
param(
  [ValidateSet('fcc','paid')][string]$Which = 'fcc',
  [Parameter(Mandatory)][string]$Brief,
  [switch]$BgOnly,
  [ValidateSet('acceptEdits','auto','bypassPermissions','dontAsk','plan')][string]$PermissionMode = 'acceptEdits'
)
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $Root
$BriefPath = (Resolve-Path $Brief).Path
$name = if ($Which -eq 'fcc') { 'DnB-FCC' } else { 'DnB-Paid' }
$bin = if ($Which -eq 'fcc') {
  'C:\Users\RIGGUSPIG\.local\bin\fcc-claude.exe'
} else {
  'C:\Users\RIGGUSPIG\AppData\Roaming\npm\claude.cmd'
}
if (-not (Test-Path $bin)) { throw "Missing binary: $bin" }

$dup = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -and $_.CommandLine -match [regex]::Escape($name) -and $_.CommandLine -match '(-p|--print|--background|--bg)'
}
if ($dup) {
  $ids = ($dup | ForEach-Object { $_.ProcessId }) -join ','
  throw "REFUSE: $name already running (PIDs $ids). List-DnBWriters.ps1 then stop."
}

# --- routing (the bug that burned paid under DnB-FCC label) ---
if ($Which -eq 'fcc') {
  Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
  $env:ANTHROPIC_BASE_URL = 'http://127.0.0.1:8082'
  $env:ANTHROPIC_AUTH_TOKEN = 'freecc'
  $env:CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = '1'
  $route = 'fcc-proxy:8082'
} else {
  Remove-Item Env:ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:ANTHROPIC_AUTH_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY -ErrorAction SilentlyContinue
  $route = 'anthropic-paid'
}

$prompt = "WRITER=$name ROUTE=$route. Read and implement this brief fully: $BriefPath. Done-when: npm.cmd test -- --run AND npx tsc --noEmit green. Soft-pass forbidden. One writer only."

$outDir = Join-Path $Root '_cos-runs'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $outDir "$name-$stamp.log"
$meta = Join-Path $outDir "$name-$stamp.meta.txt"
$active = Join-Path $outDir "ACTIVE-$Which.json"

$cliArgs = @(
  '-p', $prompt,
  '--permission-mode', $PermissionMode,
  '--permission-prompts', 'none',
  '--allowedTools', 'Read,Edit,Write,Bash(npm.cmd *),Bash(npx *),Bash(git *)',
  '-n', $name,
  '--output-format', 'json',
  '--max-turns', '40'
)
if ($BgOnly) {
  $cliArgs = @('--bg', '-n', $name, '--permission-mode', $PermissionMode, $prompt)
}

@(
  "WHICH=$Which"
  "NAME=$name"
  "ROUTE=$route"
  "BIN=$bin"
  "BASE_URL=$($env:ANTHROPIC_BASE_URL)"
  "BRIEF=$BriefPath"
  "MODE=$(if($BgOnly){'bg'}else{'print'})"
  "LOG=$log"
  "STARTED=$(Get-Date -Format o)"
) | Set-Content $meta

@{
  which = $Which
  name = $name
  route = $route
  bin = $bin
  baseUrl = $env:ANTHROPIC_BASE_URL
  brief = $BriefPath
  log = $log
  started = (Get-Date -Format o)
} | ConvertTo-Json | Set-Content -Encoding utf8 $active

Write-Host "Launch WHICH=$Which NAME=$name ROUTE=$route BASE_URL=$($env:ANTHROPIC_BASE_URL)"
Write-Host "ACTIVE=$active LOG=$log"

# avoid 3s stdin warning
$stdinNull = Join-Path $outDir 'nul-stdin.txt'
'' | Set-Content $stdinNull

try {
  Get-Content $stdinNull | & $bin @cliArgs 2>&1 | Tee-Object -FilePath $log
  "EXIT=$LASTEXITCODE" | Add-Content $meta
} finally {
  if (Test-Path $active) {
    $j = Get-Content $active -Raw | ConvertFrom-Json
    if ($j.log -eq $log) { Remove-Item $active -Force -ErrorAction SilentlyContinue }
  }
}
exit $LASTEXITCODE
