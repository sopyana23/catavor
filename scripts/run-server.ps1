Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Starting Catavor Server (Without DB Updates)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$env:DB_AUTO_MIGRATE="false"
Set-Location -Path $PSScriptRoot

if (Test-Path ".\catavor-server.exe") {
    .\catavor-server.exe
} else {
    Set-Location -Path (Join-Path $PSScriptRoot "backend")
    go run ./cmd/server/main.go
}
