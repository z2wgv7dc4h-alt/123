$p = 'C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio\scripts\cos.ps1'
$lines = Get-Content $p
$out = @()
foreach ($line in $lines) {
  if ($line -match '\$psi\.Arguments =') {
    $out += '      # FCC must NOT inherit ~/.claude/settings.json model=sonnet (bills paid Anthropic).'
    $out += '      $modelArg = if ($Which -eq ''fcc'') { '' --model nvidia_nim/nvidia/nemotron-3-super-120b-a12b'' } else { '''' }'
    $out += '      $psi.Arguments = "-p `"$prompt`" --permission-mode acceptEdits --permission-prompts none --allowedTools `"$tools`" -n $name --output-format json --max-turns 40$modelArg"'
  } else {
    $out += $line
  }
}
$out | Set-Content $p -Encoding UTF8
Write-Output 'OK'
Select-String -Path $p -Pattern 'modelArg|nemotron' | ForEach-Object { $_.Line.Trim() }
