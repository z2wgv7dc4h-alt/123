Add-Type -AssemblyName System.Windows.Forms
$sig = @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class W {
  public delegate bool CB(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(CB cb, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
}
"@
Add-Type $sig
$hits = New-Object System.Collections.Generic.List[string]
$target = [IntPtr]::Zero
[W]::EnumWindows({
  param($h,$l)
  if(-not [W]::IsWindowVisible($h)){ return $true }
  $sb = New-Object Text.StringBuilder 512
  [void][W]::GetWindowText($h, $sb, 512)
  $t = $sb.ToString()
  if($t.Length -gt 0){ $hits.Add("$h|$t") }
  if($t -match 'Claude' -or $t -match 'Edge'){
    if($t -match 'Claude'){ $script:target = $h; return $false }
  }
  return $true
}, [IntPtr]::Zero) | Out-Null
"target=$target"
$hits | Where-Object { $_ -match 'Claude|Edge' } | Select-Object -First 10
if($target -ne [IntPtr]::Zero){
  [W]::ShowWindow($target,9)|Out-Null
  [W]::SetForegroundWindow($target)|Out-Null
  Start-Sleep 2
  # click into composer: Tab a few times then paste
  [System.Windows.Forms.SendKeys]::SendWait("^v")
  Start-Sleep 1
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  "sent keys to edge/claude"
}
