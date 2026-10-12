# =========================================================================
# Catavor Git Security Hooks Setup Script
# Installs pre-commit anti-leak hook to prevent accidental pushes of secrets
# =========================================================================

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Installing Catavor Git Pre-Commit Security Guard" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $PSScriptRoot
$gitHooksDir = Join-Path $rootDir ".git\hooks"
$sourceHook = Join-Path $PSScriptRoot "git-hooks\pre-commit"
$targetHook = Join-Path $gitHooksDir "pre-commit"

if (-not (Test-Path (Join-Path $rootDir ".git"))) {
    Write-Host "[ERROR] .git directory not found! Are you in a Git repository?" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $gitHooksDir)) {
    New-Item -ItemType Directory -Path $gitHooksDir -Force | Out-Null
}

if (Test-Path $sourceHook) {
    Copy-Item -Path $sourceHook -Destination $targetHook -Force
    Write-Host "[SUCCESS] Pre-commit security hook installed to .git/hooks/pre-commit" -ForegroundColor Green
    Write-Host "[INFO] Commits containing .env files, private keys, or credentials will be automatically blocked." -ForegroundColor Yellow
} else {
    Write-Host "[ERROR] Source hook $sourceHook not found!" -ForegroundColor Red
    exit 1
}

Write-Host "==============================================" -ForegroundColor Cyan
