param(
    [switch]$NoFrontend,
    [switch]$NoBackend,
    [switch]$Build
)

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"
$VenvPython = Join-Path $RootDir "venv/Scripts/python.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AutoFix Swarm - Local Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Prerequisites ---
if (-not (Test-Path $VenvPython)) {
    Write-Error "Virtual environment not found at $VenvPython. Run: python -m venv venv"
    exit 1
}

$node = Get-Command "node" -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Error "Node.js is not installed or not in PATH"
    exit 1
}

# --- .env setup ---
$envFile = Join-Path $RootDir ".env"
$envExample = Join-Path $RootDir ".env.example"
if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
    Copy-Item $envExample $envFile
    Write-Host "Created $envFile from .env.example - edit OPENAI_API_KEY as needed." -ForegroundColor Yellow
}

$frontendEnv = Join-Path $FrontendDir ".env.local"
$frontendEnvExample = Join-Path $FrontendDir ".env.example"
if (-not (Test-Path $frontendEnv) -and (Test-Path $frontendEnvExample)) {
    Copy-Item $frontendEnvExample $frontendEnv
    Write-Host "Created $frontendEnv from .env.example" -ForegroundColor Yellow
}

# --- Create required directories ---
$logsDir = Join-Path $RootDir "logs"
$artifactsDir = Join-Path $RootDir "artifacts"
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }
if (-not (Test-Path $artifactsDir)) { New-Item -ItemType Directory -Path $artifactsDir -Force | Out-Null }

# --- Install deps if needed ---
$pipCheck = Join-Path $RootDir ".pip_installed"
if (-not (Test-Path $pipCheck)) {
    Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
    & $VenvPython -m pip install -e ".[test]" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { New-Item -ItemType File -Path $pipCheck -Force | Out-Null }
}

$npmCheck = Join-Path $FrontendDir "node_modules/.package-lock.json"
if (-not (Test-Path $npmCheck)) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location $FrontendDir; npm install 2>&1 | Out-Null
}

# --- Start services ---
$jobs = @()

if (-not $NoBackend) {
    Write-Host "Starting backend on http://localhost:8000 ..." -ForegroundColor Green
    $backendJob = Start-Job -Name "backend" -ScriptBlock {
        param($dir, $python)
        Set-Location $dir
        $env:PYTHONPATH = "$dir"
        & $python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
    } -ArgumentList $RootDir, $VenvPython
    $jobs += $backendJob
}

if (-not $NoFrontend) {
    Write-Host "Starting frontend on http://localhost:3000 ..." -ForegroundColor Green
    $frontendJob = Start-Job -Name "frontend" -ScriptBlock {
        param($dir)
        Set-Location $dir
        npm run dev
    } -ArgumentList $FrontendDir
    $jobs += $frontendJob
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Services starting up..." -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  API docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Wait for Ctrl+C
try {
    while ($true) {
        $running = $jobs | Where-Object { $_.State -eq "Running" }
        if ($running.Count -eq 0) {
            Write-Host "All services have stopped." -ForegroundColor Red
            break
        }
        Start-Sleep -Seconds 2
        foreach ($job in $jobs) {
            $output = Receive-Job $job -Keep | Select-Object -Last 2
            if ($output) { Write-Host $output }
        }
    }
} finally {
    Write-Host "Shutting down services..." -ForegroundColor Yellow
    $jobs | Stop-Job -PassThru | Remove-Job
    Write-Host "Done." -ForegroundColor Green
}
