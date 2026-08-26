Write-Host "==============================================" -ForegroundColor Green
Write-Host "Building Catavor (Desktop & Mobile Frontends)" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green

Write-Host ""
Write-Host "1. Building Desktop Frontend..." -ForegroundColor Cyan
Set-Location -Path (Join-Path $PSScriptRoot "frontend\desktop")
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Desktop Frontend build failed!" -ForegroundColor Red
    Set-Location -Path $PSScriptRoot
    exit 1
}

Write-Host ""
Write-Host "2. Building Mobile Frontend..." -ForegroundColor Cyan
Set-Location -Path (Join-Path $PSScriptRoot "frontend\mobile")
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Mobile Frontend build failed!" -ForegroundColor Red
    Set-Location -Path $PSScriptRoot
    exit 1
}

Set-Location -Path $PSScriptRoot
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "Build complete! Static bundles ready in public/ folder." -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
