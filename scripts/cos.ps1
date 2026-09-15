<#
cos.ps1 - only front door for FCC/paid
  list | status | run | stop

FIX 2026-09-14: ProcessStartInfo + NUL stdin; stream-json live log.
#>
param(
  [Parameter(Position=0)][ValidateSet('list','status','run','stop')][string]$Cmd='status',
  [ValidateSet('fcc','paid')][string]$Which='fcc',
  [string]$Brief,
  [int]$MaxTurns = 0
)
$ErrorActionPreference='Stop'
$Root='C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio'
Set-Location $Root
$runs=Join-Path $Root '_cos-runs'
New-Item -ItemType Directory -Force -Path $runs|Out-Null
$name=if($Which -eq 'fcc'){'DnB-FCC'}else{'DnB-Paid'}

function Get-Live([string]$filter) {
  Get-CimInstance Win32_Process -EA SilentlyContinue | Where-Object {
    $_.CommandLine -and $_.CommandLine -match $filter
  }
}

function Set-Route([string]$w) {
  if ($w -eq 'fcc') {
    Remove-Item Env:ANTHROPIC_API_KEY -EA SilentlyContinue
    $env:ANTHROPIC_BASE_URL='http://127.0.0.1:8082'
    $env:ANTHROPIC_AUTH_TOKEN='freecc'
    $env:CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY='1'
  } else {
    Remove-Item Env:ANTHROPIC_BASE_URL,Env:ANTHROPIC_AUTH_TOKEN,Env:CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY -EA SilentlyContinue
  }
}

switch ($Cmd) {
  'list' {
    $live=Get-Live 'DnB-FCC|DnB-Paid'
    if (-not $live) { 'LIVE: (none)' } else {
      $live | ForEach-Object {
        $k=if($_.CommandLine -match 'DnB-Paid'){'paid'}else{'fcc'}
        "LIVE: $k pid=$($_.ProcessId) $($_.Name)"
      }
    }
  }
  'status' {
    Write-Host '--- LIVE ---'
    & $PSCommandPath list
    Write-Host '--- ACTIVE ---'
    foreach ($k in 'fcc','paid') {
      $f=Join-Path $runs "ACTIVE-$k.json"
      if (Test-Path $f) { Get-Content $f -Raw } else { Write-Host ("ACTIVE-{0}: none" -f $k) }
    }
    Write-Host '--- LATEST LOG ---'
    foreach ($k in 'fcc','paid') {
      $af=Join-Path $runs ("ACTIVE-$k.json")
      if (-not (Test-Path $af)) { continue }
      $meta=Get-Content $af -Raw | ConvertFrom-Json
      $lp=$meta.log
      if (-not $lp) { Write-Host ("ACTIVE-{0}: no log path" -f $k); continue }
      if (-not (Test-Path $lp)) {
        Write-Host ("log missing on disk: {0}" -f $lp)
        continue
      }
      $len=(Get-Item $lp).Length
      Write-Host ("ACTIVE-{0} log len={1} path={2}" -f $k,$len,$lp)
      Get-Content $lp -Tail 40 -EA SilentlyContinue
    }
  }
  'stop' {
    $pat=if($Which -eq 'fcc'){'DnB-FCC'}else{'DnB-Paid'}
    Get-Live $pat | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue; "stopped $($_.ProcessId)" }
    Remove-Item (Join-Path $runs "ACTIVE-$Which.json") -Force -EA SilentlyContinue
  }
  'run' {
    if (-not $Brief) { throw 'Need -Brief' }
    $BriefPath=(Resolve-Path $Brief).Path
    if (Get-Live ([regex]::Escape($name))) { throw "Already running $name - stop first" }
    Set-Route $Which
    $bin=if($Which -eq 'fcc'){'C:\Users\RIGGUSPIG\.local\bin\fcc-claude.exe'}else{'C:\Users\RIGGUSPIG\AppData\Roaming\npm\claude.cmd'}
    $route=if($Which -eq 'fcc'){'fcc-proxy:8082'}else{'anthropic-paid'}
    $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
    $log=Join-Path $runs "$name-$stamp.log"
    $turns = $MaxTurns
    if ($turns -le 0) {
      if ($BriefPath -match 'board-chat') { $turns = 120 } else { $turns = 25 }
    }
    $outFmt = if ($BriefPath -match 'board-chat') { 'stream-json' } else { 'json' }
    $prompt="WRITER=$name. Follow BRIEF $BriefPath exactly. Do NOT re-do items marked done. Run npm.cmd test / npx tsc ONLY if the BRIEF requires it or you edited src. Soft-pass forbidden."
    @{which=$Which;name=$name;route=$route;brief=$BriefPath;log=$log;baseUrl=$env:ANTHROPIC_BASE_URL;started=(Get-Date -Format o);maxTurns=$turns;outputFormat=$outFmt} |
      ConvertTo-Json | Set-Content (Join-Path $runs "ACTIVE-$Which.json")
    "START $Which $route turns=$turns fmt=$outFmt log=$log"

    $sw = New-Object System.IO.StreamWriter($log, $false, [System.Text.UTF8Encoding]::new($false))
    $sw.AutoFlush = $true
    $code = 1
    try {
      $psi = New-Object System.Diagnostics.ProcessStartInfo
      $psi.FileName = $bin
      $tools = 'Read,Edit,Write,Bash(npm.cmd *),Bash(npx *),Bash(git *),Bash(powershell *)'
      $modelArg = if ($Which -eq 'fcc') { ' --model anthropic/nvidia_nim/nvidia/nemotron-3-super-120b-a12b' } else { '' }
      $psi.Arguments = "-p `"$prompt`" --permission-mode bypassPermissions --allow-dangerously-skip-permissions --dangerously-skip-permissions --allowedTools `"$tools`" -n $name --output-format $outFmt --verbose --max-turns $turns$modelArg"
      $psi.UseShellExecute = $false
      $psi.RedirectStandardInput = $true
      $psi.RedirectStandardOutput = $true
      $psi.RedirectStandardError = $true
      $psi.CreateNoWindow = $true
      $psi.WorkingDirectory = $Root
      $proc = New-Object System.Diagnostics.Process
      $proc.StartInfo = $psi
      $proc.EnableRaisingEvents = $true
      $outHandler = {
        if ($EventArgs.Data -ne $null) {
          $sw.WriteLine($EventArgs.Data)
        }
      }
      $errHandler = {
        if ($EventArgs.Data -ne $null) {
          $sw.WriteLine('STDERR: ' + $EventArgs.Data)
        }
      }
      $script:sw = $sw
      Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action {
        if ($null -ne $EventArgs.Data) {
          $Event.MessageData.WriteLine($EventArgs.Data)
        }
      } -MessageData $sw | Out-Null
      Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action {
        if ($null -ne $EventArgs.Data) {
          $Event.MessageData.WriteLine('STDERR: ' + $EventArgs.Data)
        }
      } -MessageData $sw | Out-Null
      [void]$proc.Start()
      $proc.BeginOutputReadLine()
      $proc.BeginErrorReadLine()
      $proc.StandardInput.Close()
      $proc.WaitForExit()
      Start-Sleep -Milliseconds 400
      Get-EventSubscriber | Where-Object { $_.SourceObject -eq $proc } | Unregister-Event -Force -EA SilentlyContinue
      $code = $proc.ExitCode
      if ($null -eq $code) { $code = 1 }
      $sw.WriteLine("EXIT=$code")
      $briefName = [IO.Path]::GetFileName($BriefPath)
      $logName = [IO.Path]::GetFileName($log)
      $when = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
      $taskLine = "| $when | $Which | $briefName | $code | $logName | |"
      Add-Content -Path (Join-Path $runs 'TASK-LOG.md') -Value $taskLine -Encoding utf8
    } catch {
      $sw.WriteLine("ERR=$_")
      $code = 1
      $sw.WriteLine("EXIT=$code")
      $briefName = [IO.Path]::GetFileName($BriefPath)
      $logName = [IO.Path]::GetFileName($log)
      $when = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
      $taskLine = "| $when | $Which | $briefName | $code | $logName | |"
      Add-Content -Path (Join-Path $runs 'TASK-LOG.md') -Value $taskLine -Encoding utf8
    } finally {
      $sw.Close()
      Remove-Item (Join-Path $runs "ACTIVE-$Which.json") -Force -EA SilentlyContinue
    }
    exit $code
  }
}
