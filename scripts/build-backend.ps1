Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Building Catavor Golang 1.23+ Production Binary" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

Set-Location -Path (Join-Path $PSScriptRoot "..\backend")

Write-Host "Running go mod tidy..." -ForegroundColor Yellow
go mod tidy
if ($LASTEXITCODE -ne 0) {
    Write-Host "go mod tidy failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Compiling server binary..." -ForegroundColor Yellow
go build -ldflags="-s -w" -o catavor-server.exe ./cmd/server/main.go
if ($LASTEXITCODE -ne 0) {
    Write-Host "go build failed!" -ForegroundColor Red
    exit 1
}

Set-Location -Path (Join-Path $PSScriptRoot "..")
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "Build complete: backend/catavor-server.exe ready!" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
