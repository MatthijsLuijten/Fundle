$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$apiPython = Join-Path $root "apps\api\.venv\Scripts\python.exe"
if (-not (Test-Path $apiPython)) {
    Write-Host ""
    Write-Host "Fundle is not set up yet. Run from the project root:" -ForegroundColor Yellow
    Write-Host "  .\setup.ps1" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

$webModules = Join-Path $root "apps\web\node_modules"
if (-not (Test-Path $webModules)) {
    Write-Host ""
    Write-Host "Web dependencies missing. Run from the project root:" -ForegroundColor Yellow
    Write-Host "  .\setup.ps1" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

if (-not (Test-Path (Join-Path $root "node_modules\concurrently"))) {
    Write-Host ""
    Write-Host "Root npm dependencies missing. Run from the project root:" -ForegroundColor Yellow
    Write-Host "  npm install" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
