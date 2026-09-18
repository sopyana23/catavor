Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Starting Catavor Server (Without DB Updates)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$env:DB_AUTO_MIGRATE="false"
$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location -Path $rootDir

$env:DB_AUTO_MIGRATE="false"

if (Test-Path ".\catavor-server.exe") {
    .\catavor-server.exe
} else {
    Set-Location -Path (Join-Path $rootDir "backend")
    go run ./cmd/server/main.go
}
