Set-Location "C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio"

$envFilter = @'
if [ "$GIT_AUTHOR_NAME" = "Wyatt" ]; then
  export GIT_AUTHOR_NAME="z2wgv7dc4h-alt"
  export GIT_AUTHOR_EMAIL="z2wgv7dc4h-alt@users.noreply.github.com"
fi
if [ "$GIT_COMMITTER_NAME" = "Wyatt" ]; then
  export GIT_COMMITTER_NAME="z2wgv7dc4h-alt"
  export GIT_COMMITTER_EMAIL="z2wgv7dc4h-alt@users.noreply.github.com"
fi
'@
$envFilter | Set-Content -Encoding ascii env-filter.sh -NoNewline

$msgFilter = @'
sed -e "s/Wyatt's/the user's/g" -e "s/Wyatt/the user/g"
'@
$msgFilter | Set-Content -Encoding ascii msg-filter.sh -NoNewline

$env:FILTER_BRANCH_SQUELCH_WARNING = "1"
$envFilterContent = Get-Content env-filter.sh -Raw
$msgFilterPath = Join-Path (Get-Location).Path "msg-filter.sh"
# Windows backslashes get eaten somewhere in filter-branch's internal shell
# quoting — use a Unix-style /c/... path instead, which Git Bash understands
# natively and has no backslash-escaping problem.
$msgFilterUnix = $msgFilterPath -replace '\\', '/'
if ($msgFilterUnix -match '^([A-Za-z]):(.*)$') {
  $msgFilterUnix = '/' + $matches[1].ToLower() + $matches[2]
}

git filter-branch -f --env-filter $envFilterContent --msg-filter "bash '$msgFilterUnix'" -- --all

Write-Host ""
Write-Host "=== Commit authors after rewrite (should show ONLY z2wgv7dc4h-alt) ==="
git log --format='%an <%ae>' | Sort-Object -Unique

Write-Host ""
Write-Host "=== Commit messages still mentioning the name (should be empty) ==="
git log --format='%H %s' -i --grep="wyatt"

Remove-Item env-filter.sh, msg-filter.sh

Write-Host ""
Write-Host "If both checks above look right, force-push with: git push --force"
