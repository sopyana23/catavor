Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Building Catavor Golang 1.23+ Production Binary" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

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

Write-Host "Build complete: catavor-server.exe ready!" -ForegroundColor Green
