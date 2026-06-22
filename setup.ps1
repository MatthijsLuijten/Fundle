# One-time Fundle setup (venv, deps, env files). Daily dev: npm run dev
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$apiDir = Join-Path $root "apps\api"
$webDir = Join-Path $root "apps\web"
$venvPython = Join-Path $apiDir ".venv\Scripts\python.exe"

Write-Host "Setting up Fundle..." -ForegroundColor Cyan

$configFile = Join-Path $root "fundle.config.env"
$configExample = Join-Path $root "fundle.config.env.example"
if (-not (Test-Path $configFile)) {
    if (-not (Test-Path $configExample)) {
        Write-Error "Missing fundle.config.env.example"
    }
    Copy-Item $configExample $configFile
    Write-Host "Created fundle.config.env from example"
}

if (-not (Test-Path $venvPython)) {
    Write-Host "Creating API virtual environment..."
    Push-Location $apiDir
    python -m venv .venv
    Pop-Location
}

Write-Host "Installing Python dependencies..."
& $venvPython -m pip install -q -r (Join-Path $apiDir "requirements.txt")

$apiEnv = Join-Path $apiDir ".env"
if (-not (Test-Path $apiEnv)) {
    Copy-Item (Join-Path $apiDir ".env.example") $apiEnv
    Write-Host "Created apps\api\.env"
}

Write-Host "Installing root npm dependencies..."
Push-Location $root
npm install --silent
Pop-Location

Write-Host "Installing web npm dependencies..."
Push-Location $webDir
if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.local.example" ".env.local"
    Write-Host "Created apps\web\.env.local"
}
npm install --silent
Pop-Location

& $venvPython (Join-Path $root "scripts\sync_config.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Setup complete. Start development with:" -ForegroundColor Green
Write-Host "  npm run dev" -ForegroundColor Cyan
Write-Host ""
