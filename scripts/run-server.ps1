Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Starting Catavor Server (Without DB Updates)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$env:DB_AUTO_MIGRATE="false"
$env:SKIP_DB_MIGRATE="true"
if (-not $env:PORT) {
    $env:PORT="8001"
}
$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location -Path $rootDir

if (Test-Path ".\catavor-server.exe") {
    .\catavor-server.exe
} else {
    Set-Location -Path (Join-Path $rootDir "backend")
    go run ./cmd/server/main.go
}
