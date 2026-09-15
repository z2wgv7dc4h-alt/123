param([ValidateSet('fcc','paid')][string]$Which='fcc')
function Get-Ancestors([int]$ProcId) {
  $list = New-Object System.Collections.Generic.List[object]
  $cur = $ProcId
  for ($i=0; $i -lt 12; $i++) {
    $ci = Get-CimInstance Win32_Process -Filter "ProcessId=$cur" -EA SilentlyContinue
    if (-not $ci) { break }
    $list.Add([pscustomobject]@{ ProcId=$ci.ProcessId; Name=$ci.Name; Parent=$ci.ParentProcessId }) | Out-Null
    $cur = $ci.ParentProcessId
    if ($cur -eq 0) { break }
  }
  return ,$list.ToArray()
}
function First-Hwnd([object[]]$nodes) {
  foreach ($n in $nodes) {
    $p = Get-Process -Id $n.ProcId -EA SilentlyContinue
    if ($p -and [int64]$p.MainWindowHandle -ne 0) {
      return [pscustomobject]@{ ProcId=$p.Id; Hwnd=[int64]$p.MainWindowHandle; Proc=$p.ProcessName }
    }
  }
  return $null
}
# Also EnumWindows for PIDs in chain (conhost often holds HWND)
Add-Type @"
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public class WinFind {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lp, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  public static IntPtr Find(HashSet<uint> pids) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h,l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pids.Contains(pid) && IsWindowVisible(h)) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
function Find-Enum([int[]]$ids) {
  $set = New-Object 'System.Collections.Generic.HashSet[uint]'
  foreach ($id in $ids) { [void]$set.Add([uint]$id) }
  # include conhost children of these
  Get-CimInstance Win32_Process -Filter "Name='conhost.exe'" -EA SilentlyContinue | ForEach-Object {
    if ($ids -contains $_.ParentProcessId) { [void]$set.Add([uint]$_.ProcessId) }
  }
  $h = [WinFind]::Find($set)
  if ($h -ne [IntPtr]::Zero) { return [int64]$h }
  return 0
}
if ($Which -eq 'fcc') {
  $fcc = Get-Process fcc-claude -EA SilentlyContinue | Select-Object -First 1
  if (-not $fcc) { 'FOUND=0 KIND=fcc REASON=no_fcc-claude'; exit 1 }
  $chain = Get-Ancestors $fcc.Id
  $hit = First-Hwnd $chain
  if ($hit) { "FOUND=1 KIND=fcc FCCPID=$($fcc.Id) PID=$($hit.ProcId) HWND=$($hit.Hwnd) PROC=$($hit.Proc)"; exit 0 }
  $ids = @($fcc.Id) + @($chain | ForEach-Object { $_.ProcId })
  $hwnd = Find-Enum $ids
  if ($hwnd -ne 0) { "FOUND=1 KIND=fcc FCCPID=$($fcc.Id) HWND=$hwnd PROC=enum"; exit 0 }
  "FOUND=0 KIND=fcc REASON=no_hwnd FCCPID=$($fcc.Id)"; exit 1
}
$fccIds = @(Get-Process fcc-claude -EA SilentlyContinue | ForEach-Object { $_.Id })
foreach ($c in (Get-Process claude -EA SilentlyContinue)) {
  $chain = Get-Ancestors $c.Id
  if ($chain | Where-Object { $_.Name -match 'fcc-claude' }) { continue }
  $hit = First-Hwnd $chain
  if ($hit) { "FOUND=1 KIND=paid CLAUDEPID=$($c.Id) PID=$($hit.ProcId) HWND=$($hit.Hwnd) PROC=$($hit.Proc)"; exit 0 }
  $ids = @($c.Id) + @($chain | ForEach-Object { $_.ProcId })
  $hwnd = Find-Enum $ids
  if ($hwnd -ne 0) { "FOUND=1 KIND=paid CLAUDEPID=$($c.Id) HWND=$hwnd PROC=enum"; exit 0 }
}
'FOUND=0 KIND=paid REASON=no_hwnd'; exit 1
