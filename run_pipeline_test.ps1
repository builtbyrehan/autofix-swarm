#!/usr/bin/env pwsh
# ==============================================================================
# AutoFix Swarm — Full Pipeline Execution & Eval Test Script
# Date: July 19, 2026
# Context: OpenAI Build Week v1 Scope
#
# This script runs the complete pipeline:
#   Watcher (GPT-5.6 + Semgrep) -> Codex Fixer -> Reviewer
# Then scores results against the seeded ground truth.
#
# Prerequisites:
#   - Python 3.11+ with venv activated
#   - .env with OPENAI_API_KEY set (OpenRouter)
#   - Docker Desktop running (for sandboxed fixes)
#   - Codex CLI installed (for fix generation)
#   - Semgrep installed (for static analysis, optional)
# ==============================================================================

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " AutoFix Swarm - Full Pipeline Test" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Environment Setup & Verification ──────────────────────────────────────
Write-Host "[1/5] Verifying Python environment and dependencies..." -ForegroundColor Yellow

# Activate venv
$venvActivate = Join-Path $ProjectRoot ".venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    & $venvActivate
    Write-Host "  Venv activated." -ForegroundColor Green
} else {
    Write-Host "  ERROR: .venv not found. Run: python -m venv .venv" -ForegroundColor Red
    exit 1
}

# Load .env into environment
$envFile = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $envFile)) {
    $envExample = Join-Path $ProjectRoot ".env.example"
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "  Created .env from .env.example" -ForegroundColor Yellow
    }
}

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            if ($parts.Length -eq 2) {
                [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
            }
        }
    }
    Write-Host "  .env loaded." -ForegroundColor Green
}

Write-Host "  Python: $(python --version 2>&1)" -ForegroundColor Green
$hasApiKey = [bool]$env:OPENAI_API_KEY
Write-Host "  OPENAI_API_KEY set: $hasApiKey" -ForegroundColor $(if ($hasApiKey) { "Green" } else { "Red" })

# ── 2. Docker & Prerequisites Check ──────────────────────────────────────────
Write-Host ""
Write-Host "[2/5] Checking Docker and prerequisites..." -ForegroundColor Yellow

# Docker
$dockerOk = $false
try {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
} catch {}
Write-Host "  Docker: $(if ($dockerOk) { 'running' } else { 'NOT running' })" -ForegroundColor $(if ($dockerOk) { "Green" } else { "Yellow" })

# Semgrep
$semgrepOk = $false
try {
    $null = semgrep --version 2>&1
    if ($LASTEXITCODE -eq 0) { $semgrepOk = $true }
} catch {}
Write-Host "  Semgrep: $(if ($semgrepOk) { 'installed' } else { 'NOT installed (GPT-only detection)' })" -ForegroundColor $(if ($semgrepOk) { "Green" } else { "Yellow" })

# Codex CLI
$codexOk = $false
try {
    $null = codex --version 2>&1
    if ($LASTEXITCODE -eq 0) { $codexOk = $true }
} catch {}
Write-Host "  Codex CLI: $(if ($codexOk) { 'available' } else { 'NOT installed (Fixer will be blocked)' })" -ForegroundColor $(if ($codexOk) { "Green" } else { "Yellow" })

# ── 3. Clean Previous Logs ───────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/5] Clearing previous run logs..." -ForegroundColor Yellow
$dbPath = Join-Path $ProjectRoot "logs\run_log.db"
if (Test-Path $dbPath) {
    Remove-Item $dbPath -Force
    Write-Host "  Previous SQLite logs cleared." -ForegroundColor Green
} else {
    Write-Host "  No previous logs to clear." -ForegroundColor Green
}
New-Item -ItemType Directory -Path (Join-Path $ProjectRoot "artifacts") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectRoot "logs") -Force | Out-Null

# ── 4. Execute Full Pipeline ─────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/5] Running Full Pipeline (Watcher -> Fixer -> Reviewer)..." -ForegroundColor Yellow
Write-Host "  Target: seeded_repo (7 planted bugs)" -ForegroundColor White
Write-Host "  Detection: $(if ($semgrepOk) { 'Semgrep + GPT-5.6' } else { 'GPT-5.6 only' })" -ForegroundColor White
Write-Host "  Fixing: $(if ($codexOk) { 'Codex CLI (sandboxed)' } else { 'BLOCKED (no Codex CLI)' })" -ForegroundColor White
Write-Host "  Verification: pytest + GPT-5.6 explanation" -ForegroundColor White
Write-Host "  -------------------------------------------" -ForegroundColor DarkGray

# Run the Python pipeline script
$pipelineScript = Join-Path $ProjectRoot "_run_pipeline_test.py"
if (Test-Path $pipelineScript) {
    python $pipelineScript 2>&1 | ForEach-Object { Write-Host $_ }
} else {
    Write-Host "  ERROR: _run_pipeline_test.py not found" -ForegroundColor Red
    exit 1
}

# ── 5. Score Against Ground Truth ────────────────────────────────────────────
Write-Host ""
Write-Host "[5/5] Scoring against ground truth..." -ForegroundColor Yellow

$issuesPath = Join-Path $ProjectRoot "artifacts\issues.json"
$verdictsPath = Join-Path $ProjectRoot "artifacts\verdicts.json"

if (Test-Path $issuesPath) {
    if (Test-Path $verdictsPath) {
        python -m eval.run_eval --issues $issuesPath --verdicts $verdictsPath 2>&1 | ForEach-Object { Write-Host $_ }
    } else {
        python -m eval.run_eval --issues $issuesPath 2>&1 | ForEach-Object { Write-Host $_ }
    }
} else {
    Write-Host "  No issues file found. Skipping scoring." -ForegroundColor Red
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Pipeline Test Complete" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Artifacts:" -ForegroundColor White
Write-Host "  artifacts/issues.json   - detected issues" -ForegroundColor Gray
Write-Host "  artifacts/fixes.json    - fix attempts" -ForegroundColor Gray
Write-Host "  artifacts/verdicts.json - verification results" -ForegroundColor Gray
Write-Host ""
Write-Host "To view dashboard: cd frontend && npm run dev" -ForegroundColor White
Write-Host "To view API docs:  python -m uvicorn backend.main:app --reload" -ForegroundColor White
Write-Host ""
