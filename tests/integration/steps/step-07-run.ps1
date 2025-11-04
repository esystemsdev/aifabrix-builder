# Step 7: Run Docker Container
# Tests aifabrix run command and validates docker-compose.yaml

param(
    [string]$Language = "python",
    [string]$AppName = $null,
    [int]$Port = 0
)

. "$PSScriptRoot\common.ps1"

# Set defaults if not provided
if ($null -eq $AppName) { $AppName = Get-LanguageAppName $Language }
if ($Port -eq 0) { $Port = Get-LanguagePort $Language }

Write-StepHeader "Run Docker Container" "07"

# Verify app exists
$appInfo = Test-AppExists -AppName $AppName
if (-not $appInfo.Builder) {
    Write-StepError "Application not found. Run step-01-create.ps1 first."
    exit 1
}

# Check Docker is running
if (-not (Test-DockerRunning)) {
    Write-StepError "Docker is not running. Please start Docker Desktop and try again."
    exit 1
}

# Ensure infrastructure is running
if (-not (Test-InfrastructureRunning)) {
    Write-StepWarning "Infrastructure is not running. Starting infrastructure..."
    aifabrix up
    if ($LASTEXITCODE -ne 0) {
        Write-StepError "Could not start infrastructure. Run 'aifabrix up' manually."
        exit 1
    }
    Write-Host "Waiting for infrastructure to be healthy..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
} else {
    Write-StepSuccess "Infrastructure is running"
}

# Run container
Write-Host "Running Docker container..." -ForegroundColor Green
aifabrix run $AppName --port $Port
$runExitCode = $LASTEXITCODE

# Verify docker-compose.yaml was generated
$composeFile = Join-Path $appInfo.BuilderPath "docker-compose.yaml"
if (-not (Test-Path $composeFile)) {
    Write-StepError "docker-compose.yaml file not generated"
    exit 1
}
Write-StepSuccess "docker-compose.yaml file generated"

# Verify compose file contains db-init service
$composeContent = Get-Content $composeFile -Raw
if ($composeContent -notmatch "db-init:") {
    Write-StepError "docker-compose.yaml does not contain db-init service"
    exit 1
}
Write-StepSuccess "docker-compose.yaml contains db-init service"

if ($composeContent -notmatch "depends_on:") {
    Write-StepError "docker-compose.yaml does not contain depends_on"
    exit 1
}
Write-StepSuccess "docker-compose.yaml contains depends_on"

# Wait for container to start
Start-Sleep -Seconds 3

# Verify container is running
if (-not (Test-ContainerRunning -ContainerName "aifabrix-${AppName}")) {
    Write-StepError "Container is not running"
    if ($runExitCode -ne 0) {
        Write-StepError "aifabrix run command failed with exit code: $runExitCode"
    }
    exit 1
}
Write-StepSuccess "Container is running"

# Wait for database initialization
Write-Host "Waiting for database initialization..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-StepSuccess "Step 07 completed successfully"
exit 0

