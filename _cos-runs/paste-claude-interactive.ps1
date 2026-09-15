$ErrorActionPreference = "Stop"
$brief = Get-Content "C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio\_cos-runs\CLAUDE-PHONE-BRIEF.md" -Raw
cmd /c "type C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio\_cos-runs\CLAUDE-PHONE-BRIEF.md | clip" | Out-Null
Start-Process "shell:AppsFolder\Claude_pzs8sxrjxfjjc!Claude"
Start-Sleep 6
Add-Type -AssemblyName System.Windows.Forms
$code = @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class U {
  public delegate bool CB(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(CB cb, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int dwProcessId);
}
"@
Add-Type $code
[U]::AllowSetForegroundWindow(-1) | Out-Null
$target = [IntPtr]::Zero
[U]::EnumWindows({
  param($h,$l)
  if(-not [U]::IsWindowVisible($h)){ return $true }
  $sb = New-Object Text.StringBuilder 512
  [void][U]::GetWindowText($h, $sb, 512)
  $t = $sb.ToString()
  if($t -match '^Claude' -or ($t -match 'Claude' -and $t -notmatch 'Free Claude|Notepad|brief')){
    $script:target = $h; return $false
  }
  return $true
}, [IntPtr]::Zero) | Out-Null
"hwnd=$target" | Out-File "$env:TEMP\claude-paste-log.txt" -Encoding utf8
if($target -eq [IntPtr]::Zero){ "NO_WINDOW" | Add-Content "$env:TEMP\claude-paste-log.txt"; exit 2 }
[U]::ShowWindow($target, 9) | Out-Null
[U]::SetForegroundWindow($target) | Out-Null
Start-Sleep -Milliseconds 1000
[System.Windows.Forms.SendKeys]::SendWait("^n")
Start-Sleep -Milliseconds 1500
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Milliseconds 800
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
"OK" | Add-Content "$env:TEMP\claude-paste-log.txt"
