# Generic Workflow Step-by-Step Integration Test
# Master script that runs all test steps sequentially for a given language

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("python", "typescript")]
    [string]$Language,
    
    [string]$AppName = $null,
    [int]$Port = 0
)

$ErrorActionPreference = "Stop"

# Ensure we're running from the project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)
Set-Location $projectRoot

$stepsDir = Join-Path $scriptPath "steps"

# Load common functions to get default values
. "$stepsDir\common.ps1"

# Set defaults if not provided
if ([string]::IsNullOrEmpty($AppName)) { $AppName = Get-LanguageAppName $Language }
if ($Port -eq 0) { $Port = Get-LanguagePort $Language }

$languageDisplay = $Language.Substring(0,1).ToUpper() + $Language.Substring(1).ToLower()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "$languageDisplay Workflow Step-by-Step Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running from: $(Get-Location)" -ForegroundColor Gray
Write-Host "Language: $Language" -ForegroundColor Gray
Write-Host "App Name: $AppName" -ForegroundColor Gray
Write-Host "Port: $Port" -ForegroundColor Gray
Write-Host ""

# Parse command line arguments for specific step
$runSpecificStep = $null
if ($args.Count -gt 0) {
    if ($args[0] -eq "--step" -and $args.Count -gt 1) {
        $runSpecificStep = $args[1]
    } elseif ($args[0] -match "^step-\d+") {
        $runSpecificStep = $args[0]
    }
}

# Define test steps
$steps = @(
    @{ Name = "step-01-create.ps1"; Description = "Create Application" },
    @{ Name = "step-02-dockerfile.ps1"; Description = "Generate Dockerfile" },
    @{ Name = "step-03-resolve.ps1"; Description = "Resolve Secrets" },
    @{ Name = "step-04-json.ps1"; Description = "Generate Deployment JSON" },
    @{ Name = "step-05-genkey.ps1"; Description = "Generate Deployment Key" },
    @{ Name = "step-06-build.ps1"; Description = "Build Docker Image" },
    @{ Name = "step-07-run.ps1"; Description = "Run Docker Container" },
    @{ Name = "step-08-validate-database.ps1"; Description = "Validate Database Creation" },
    @{ Name = "step-09-validate-health.ps1"; Description = "Validate Health Check and Database Connection" }
)

# If specific step requested, run only that step
if ($runSpecificStep) {
    $stepFile = if ($runSpecificStep -match "^step-\d+") {
        "$runSpecificStep.ps1"
    } else {
        $runSpecificStep
    }
    
    $stepPath = Join-Path $stepsDir $stepFile
    if (-not (Test-Path $stepPath)) {
        Write-Host "ERROR: Step file not found: $stepFile" -ForegroundColor Red
        Write-Host "Available steps:" -ForegroundColor Yellow
        foreach ($step in $steps) {
            Write-Host "  $($step.Name)" -ForegroundColor Gray
        }
        exit 1
    }
    
    Write-Host "Running single step: $stepFile" -ForegroundColor Cyan
    Write-Host ""
    & $stepPath -Language $Language -AppName $AppName -Port $Port
    exit $LASTEXITCODE
}

# Run all steps sequentially
$passedSteps = @()
$failedSteps = @()
$skippedSteps = @()

foreach ($step in $steps) {
    $stepPath = Join-Path $stepsDir $step.Name
    
    if (-not (Test-Path $stepPath)) {
        Write-Host "WARNING: Step file not found: $($step.Name)" -ForegroundColor Yellow
        $skippedSteps += $step
        continue
    }
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Running: $($step.Description)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        & $stepPath -Language $Language -AppName $AppName -Port $Port
        if ($LASTEXITCODE -eq 0) {
            $passedSteps += $step
            Write-Host ""
            Write-Host "✓ Step completed successfully" -ForegroundColor Green
        } else {
            $failedSteps += $step
            Write-Host ""
            Write-Host "✗ Step failed with exit code: $LASTEXITCODE" -ForegroundColor Red
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "Test Run Stopped" -ForegroundColor Yellow
            Write-Host "Failed at: $($step.Description)" -ForegroundColor Red
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "To rerun from beginning: .\test-workflow-step-by-step.ps1 -Language $Language" -ForegroundColor Yellow
            Write-Host "To rerun this step: .\test-workflow-step-by-step.ps1 -Language $Language --step $($step.Name)" -ForegroundColor Yellow
            break
        }
    } catch {
        $failedSteps += $step
        Write-Host ""
        Write-Host "✗ Step failed with error: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Test Run Stopped" -ForegroundColor Yellow
        Write-Host "Failed at: $($step.Description)" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Cyan
        break
    }
    
    Write-Host ""
}

# Print summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Passed: $($passedSteps.Count)" -ForegroundColor Green
Write-Host "Failed: $($failedSteps.Count)" -ForegroundColor $(if ($failedSteps.Count -eq 0) { "Green" } else { "Red" })
Write-Host "Skipped: $($skippedSteps.Count)" -ForegroundColor $(if ($skippedSteps.Count -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($failedSteps.Count -gt 0) {
    Write-Host "Failed Steps:" -ForegroundColor Red
    foreach ($step in $failedSteps) {
        Write-Host "  ✗ $($step.Description)" -ForegroundColor Red
    }
    Write-Host ""
    exit 1
}

if ($skippedSteps.Count -gt 0) {
    Write-Host "Skipped Steps:" -ForegroundColor Yellow
    foreach ($step in $skippedSteps) {
        Write-Host "  ⚠ $($step.Description)" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All tests passed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Application is running at: http://localhost:$Port" -ForegroundColor Cyan
Write-Host "Health check: http://localhost:$Port/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop the container: docker stop aifabrix-$AppName" -ForegroundColor Yellow
Write-Host "To view logs: docker logs aifabrix-$AppName -f" -ForegroundColor Yellow

exit 0

