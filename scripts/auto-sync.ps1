#Requires -Version 5.1
# Auto sync: pull --rebase -> commit -> push  (Mon-Sat 9:00-17:00)
# Logs to z:\scripts\auto-sync.log

$ErrorActionPreference = 'Continue'
$repo = 'z:\'
$log  = 'z:\scripts\auto-sync.log'
$ts   = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

function Write-Log($msg) {
    "$ts  $msg" | Out-File -FilePath $log -Append -Encoding utf8
}

Set-Location $repo

Write-Log '--- auto-sync start ---'

# Pull first (autostash protects uncommitted work)
$pull = git pull --rebase --autostash origin main 2>&1 | Out-String
Write-Log "pull: $($pull.Trim())"

# Stage everything and check if there is anything to commit
git add -A
$staged = git diff --cached --name-only
if ($staged) {
    $msg = "auto-sync $ts"
    $commit = git commit -m $msg 2>&1 | Out-String
    Write-Log "commit ($($staged.Count) files): $($commit.Trim())"
} else {
    Write-Log 'commit: nothing to commit'
}

# Push only if local is ahead
$ahead = git rev-list --count '@{u}..HEAD' 2>$null
if ($ahead -and [int]$ahead -gt 0) {
    $push = git push origin main 2>&1 | Out-String
    Write-Log "push ($ahead commits): $($push.Trim())"
} else {
    Write-Log 'push: nothing to push'
}

Write-Log '--- auto-sync end ---'
