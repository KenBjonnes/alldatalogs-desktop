<#
.SYNOPSIS
  Cut a BigData for Windows release: refresh the payload from the current viewer release, run the
  gates, bump the version, commit, tag, push. GitHub Actions (release.yml) builds and publishes the
  installer; installed apps pick it up on their next check.

.EXAMPLE
  .\scripts\release.ps1 -Bump patch            # 0.1.0 -> 0.1.1
  .\scripts\release.ps1 -Bump minor -Smoke     # also runs the Electron smoke test first
  .\scripts\release.ps1 -Bump patch -NoPush    # everything except the push (inspect, then git push --follow-tags)
#>
param(
  [ValidateSet('patch', 'minor', 'major')] [string] $Bump = 'patch',
  [switch] $Smoke,
  [switch] $NoPush
)
# Not 'Stop': under Windows PowerShell 5.1 a native command that merely WRITES to stderr (git push's
# "To https://…" progress lines) becomes a terminating error, which aborted the runbook after a
# successful push. Failures are detected by exit code in Run() instead.
$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')

function Step($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }
function Run($cmd) { Write-Host "   > $cmd" -ForegroundColor DarkGray; Invoke-Expression $cmd; if ($LASTEXITCODE -ne 0) { throw "failed: $cmd" } }

Step 'Working tree must be clean (the release commit should contain only the payload refresh + version)'
$dirty = git status --porcelain
if ($dirty) { Write-Host $dirty; throw 'Commit or stash your changes first.' }
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne 'main') { throw "Releases are cut from main (you are on $branch)." }

Step 'Refresh payload from the RELEASE viewer + site repo'
Run 'node scripts/build-payload.mjs'
Run 'node scripts/build-payload.mjs --check'

Step 'Unit tests'
Run 'npm test'

if ($Smoke) {
  Step 'Electron smoke test'
  Run 'node scripts/smoke.mjs'
}

Step "Bump version ($Bump)"
$old = (Get-Content package.json -Raw | ConvertFrom-Json).version
Run "npm version $Bump --no-git-tag-version"
$new = (Get-Content package.json -Raw | ConvertFrom-Json).version
Write-Host "   $old -> $new"

Step 'Commit + tag'
git add -A
$msgFile = Join-Path $env:TEMP "bigdata-release-$new.txt"
$site = (Get-Content payload/BUNDLED.json -Raw | ConvertFrom-Json).sources.siteCommit
$session = if ($env:BIGDATA_SESSION) { $env:BIGDATA_SESSION } else { 'desktop-ken-manual' }
$text = @"
Release v$new

Payload refreshed from the RELEASE viewer and alldatalogs @ $site.

Session: $session
Agent: $(if ($env:BIGDATA_AGENT) { $env:BIGDATA_AGENT } else { 'Ken' })
"@
[System.IO.File]::WriteAllText($msgFile, $text, (New-Object System.Text.UTF8Encoding($false)))
Run "git commit -q -F `"$msgFile`""
Run "git tag -a v$new -m `"BigData v$new`""

if ($NoPush) { Write-Host "`nNot pushing (-NoPush). When ready: git push --follow-tags" -ForegroundColor Yellow; exit 0 }

Step 'Push (CI builds + publishes the installer)'
Run 'git push --follow-tags'
Write-Host "`nTagged v$new. Watch: gh run list --workflow release.yml --limit 1" -ForegroundColor Green
