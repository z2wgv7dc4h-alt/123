# List-DnBWriters.ps1 — only trustworthy status view
$ErrorActionPreference='SilentlyContinue'
$root='C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio'
$runs=Join-Path $root '_cos-runs'
$rows=@()
Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -and (
    $_.CommandLine -match '-n\s+"?DnB-FCC' -or
    $_.CommandLine -match '-n\s+"?DnB-Paid' -or
    $_.CommandLine -match 'DnB-FCC' -or
    $_.CommandLine -match 'DnB-Paid' -or
    $_.CommandLine -match 'dnb-paid-sonnet' -or
    $_.CommandLine -match 'dnb-fcc-'
  )
} | ForEach-Object {
  $kind = if ($_.CommandLine -match 'DnB-Paid|dnb-paid-sonnet') { 'paid' }
          elseif ($_.CommandLine -match 'DnB-FCC|dnb-fcc-') { 'fcc' }
          else { 'unknown' }
  $rows += [pscustomobject]@{
    Kind=$kind; Pid=$_.ProcessId; Parent=$_.ParentProcessId; Name=$_.Name
    Cmd=$_.CommandLine.Substring(0,[Math]::Min(140,$_.CommandLine.Length))
  }
}
Write-Host '=== LIVE ==='
if (-not $rows -or $rows.Count -eq 0) { Write-Host '(none)' } else { $rows | Format-Table -AutoSize Kind,Pid,Parent,Name,Cmd }

Write-Host '=== ACTIVE MARKERS (stale PIDs pruned) ==='
foreach ($k in 'fcc','paid') {
  $f=Join-Path $runs "ACTIVE-$k.json"
  if (-not (Test-Path $f)) { Write-Host "ACTIVE-$k.json: missing"; continue }
  $j=Get-Content $f -Raw | ConvertFrom-Json
  $alive=$false
  if ($j.pid) { $alive=[bool](Get-Process -Id $j.pid -EA SilentlyContinue) }
  if (-not $alive -and $j.name) {
    $alive=[bool](Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match [regex]::Escape([string]$j.name) })
  }
  if (-not $alive -and $k -eq 'fcc') {
    $alive=[bool]($rows | Where-Object { $_.Kind -eq 'fcc' })
  }
  if (-not $alive -and $k -eq 'paid') {
    $alive=[bool]($rows | Where-Object { $_.Kind -eq 'paid' })
  }
  if (-not $alive) {
    Remove-Item $f -Force
    Write-Host "ACTIVE-$k.json: STALE — deleted"
  } else {
    Write-Host "ACTIVE-$k.json:"
    $j | ConvertTo-Json -Compress
  }
}
Write-Host '=== RULES ==='
Write-Host 'FCC requires ACTIVE.route=fcc-proxy:8082 and BASE_URL=http://127.0.0.1:8082'
Write-Host 'Paid requires BASE_URL cleared. Never trust ProcessName or window titles.'
