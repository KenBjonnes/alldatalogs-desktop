<#
.SYNOPSIS
  One-shot setup for the four non-secret Azure Trusted Signing repo variables (see docs/code-signing.md,
  Part 2). Run this AFTER identity validation and the certificate profile are done in Azure -- once you
  have the endpoint, account name, profile name, and approved publisher name in hand.

.DESCRIPTION
  Sets TRUSTED_SIGNING_ENDPOINT, TRUSTED_SIGNING_ACCOUNT, TRUSTED_SIGNING_PROFILE, and
  TRUSTED_SIGNING_PUBLISHER as GitHub Actions repository VARIABLES (not secrets -- these are safe to
  pass on a command line or leave in shell history). It does NOT touch AZURE_TENANT_ID, AZURE_CLIENT_ID,
  or AZURE_CLIENT_SECRET -- those are credentials and must be pasted directly into GitHub's Secrets tab
  yourself (Settings -> Secrets and variables -> Actions -> Secrets), never through a script or a chat.

.EXAMPLE
  ./scripts/set-signing-vars.ps1 `
    -Endpoint 'https://eus.codesigning.azure.net' `
    -Account 'adl-signing' `
    -ProfileName 'adl-public-trust' `
    -Publisher 'Palm Beach Dyno, Inc.'
#>
param(
  [Parameter(Mandatory)] [string] $Endpoint,
  [Parameter(Mandatory)] [string] $Account,
  [Parameter(Mandatory)] [string] $ProfileName,
  [Parameter(Mandatory)] [string] $Publisher,
  [string] $Repo = 'KenBjonnes/alldatalogs-desktop'
)

function Step($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }

Step 'Checking gh CLI'
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) not found. Install it first (https://cli.github.com), then run 'gh auth login'."
}
gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  throw "gh is not authenticated. Run 'gh auth login' first, then re-run this script."
}

Step "Setting the four TRUSTED_SIGNING_* variables on $Repo"
gh variable set TRUSTED_SIGNING_ENDPOINT  --repo $Repo --body $Endpoint
gh variable set TRUSTED_SIGNING_ACCOUNT   --repo $Repo --body $Account
gh variable set TRUSTED_SIGNING_PROFILE   --repo $Repo --body $ProfileName
gh variable set TRUSTED_SIGNING_PUBLISHER --repo $Repo --body $Publisher
if ($LASTEXITCODE -ne 0) { throw 'gh variable set failed -- check the error above.' }

Step 'Current values'
gh variable list --repo $Repo | Select-String 'TRUSTED_SIGNING'

Write-Host "`nStill needed before a build signs: the three secrets (AZURE_TENANT_ID, AZURE_CLIENT_ID," -ForegroundColor Yellow
Write-Host "AZURE_CLIENT_SECRET) pasted into GitHub -> Settings -> Secrets and variables -> Actions -> Secrets." -ForegroundColor Yellow
Write-Host "This script deliberately never touches those -- paste them yourself, not through any script." -ForegroundColor Yellow
Write-Host "`nOnce all seven exist, the next '.\scripts\release.ps1 -Bump patch' builds a signed installer." -ForegroundColor Green
