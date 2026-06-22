# Start API + web (requires existing .venv and node_modules).
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

$apiPython = Join-Path $root "apps\api\.venv\Scripts\python.exe"
if (-not (Test-Path $apiPython)) {
    Write-Error "API venv not found. Run .\setup.ps1 from the project root first."
}

& $apiPython (Join-Path $root "scripts\sync_config.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$webDir = Join-Path $root "apps\web"
if (-not (Test-Path (Join-Path $webDir "node_modules"))) {
    Write-Error "Web dependencies not found. Run .\setup.ps1 from the project root first."
}

$env:WATCHFILES_FORCE_POLLING = "1"
Start-Process pwsh -ArgumentList @(
    "-NoExit",
    "-Command",
    "`$env:WATCHFILES_FORCE_POLLING='1'; Set-Location '$root\apps\api'; & '$apiPython' -m uvicorn app.main:app --reload --reload-dir app --port 8000"
)

Start-Process pwsh -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$webDir'; npm run dev"
)

Write-Host "Started API on http://localhost:8000 and web on http://localhost:3000 (two new windows)."
