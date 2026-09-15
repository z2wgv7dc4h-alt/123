$briefPath = "C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio\_cos-runs\CLAUDE-PHONE-BRIEF.md"
$brief = Get-Content $briefPath -Raw
# clipboard via clip
$brief | Set-Content -Path "$env:TEMP\claude-brief.txt" -Encoding utf8
cmd /c "type %TEMP%\claude-brief.txt | clip"
Start-Process "shell:AppsFolder\Claude_pzs8sxrjxfjjc!Claude"
Start-Sleep 5
Add-Type -AssemblyName System.Windows.Forms
$sig = @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class N {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lp, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
}
"@
Add-Type $sig
$target = [IntPtr]::Zero
[N]::EnumWindows({
  param($h,$l)
  if(-not [N]::IsWindowVisible($h)){ return $true }
  $sb = New-Object Text.StringBuilder 512
  [void][N]::GetWindowText($h, $sb, 512)
  $t = $sb.ToString()
  if($t -like "*Claude*" -and $t -notlike "*Free Claude*"){ $script:target = $h; return $false }
  return $true
}, [IntPtr]::Zero) | Out-Null
"target=$target"
if($target -ne [IntPtr]::Zero){
  [N]::ShowWindow($target, 9) | Out-Null
  [N]::SetForegroundWindow($target) | Out-Null
  Start-Sleep -Milliseconds 800
  [System.Windows.Forms.SendKeys]::SendWait("^n")
  Start-Sleep -Milliseconds 1200
  [System.Windows.Forms.SendKeys]::SendWait("^a")
  Start-Sleep -Milliseconds 200
  [System.Windows.Forms.SendKeys]::SendWait("^v")
  Start-Sleep -Milliseconds 800
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  "pasted"
} else {
  "no Claude window"
}
