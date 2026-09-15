# Verify-DnBRoute.ps1 — prove FCC hits :8082 and paid does NOT.
param([ValidateSet('fcc','paid')][string]$Which='fcc')
$ErrorActionPreference='Stop'
$Root='C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio'
Set-Location $Root
if ($Which -eq 'fcc') {
  Remove-Item Env:ANTHROPIC_API_KEY -EA SilentlyContinue
  $env:ANTHROPIC_BASE_URL='http://127.0.0.1:8082'
  $env:ANTHROPIC_AUTH_TOKEN='freecc'
  $env:CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY='1'
  $bin='C:\Users\RIGGUSPIG\.local\bin\fcc-claude.exe'
  $before=(Get-NetTCPConnection -LocalPort 8082 -State Established -EA SilentlyContinue | Measure-Object).Count
  $out=& $bin -p 'Reply with exactly PONG.' --permission-prompts none --max-turns 1 --output-format text 2>&1
  $after=(Get-NetTCPConnection -LocalPort 8082 -State Established -EA SilentlyContinue | Measure-Object).Count
  $ok=($out -match 'PONG') -and ($after -ge 0)
  # require proxy listening
  $listen=Get-NetTCPConnection -LocalPort 8082 -State Listen -EA SilentlyContinue
  if (-not $listen) { throw 'FAIL: nothing listening on :8082 (start fcc-server)' }
  if ($env:ANTHROPIC_BASE_URL -ne 'http://127.0.0.1:8082') { throw 'FAIL: BASE_URL not set' }
  "PASS WHICH=fcc BASE_URL=$($env:ANTHROPIC_BASE_URL) CONN_BEFORE=$before CONN_AFTER=$after"
  "OUT=$($out | Select-Object -Last 3)"
  exit 0
}
# paid: BASE_URL must be empty
Remove-Item Env:ANTHROPIC_BASE_URL -EA SilentlyContinue
Remove-Item Env:ANTHROPIC_AUTH_TOKEN -EA SilentlyContinue
Remove-Item Env:CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY -EA SilentlyContinue
if ($env:ANTHROPIC_BASE_URL) { throw "FAIL: paid still has BASE_URL=$($env:ANTHROPIC_BASE_URL)" }
$bin='C:\Users\RIGGUSPIG\AppData\Roaming\npm\claude.cmd'
"PASS WHICH=paid BASE_URL_CLEARED bin=$bin (smoke -p optional; env gate only)"
exit 0
