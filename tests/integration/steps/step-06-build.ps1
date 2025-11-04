# Step 6: Build Docker Image
# Tests aifabrix build command

param(
    [string]$Language = "python",
    [string]$AppName = $null,
    [int]$Port = 0
)

. "$PSScriptRoot\common.ps1"

# Set defaults if not provided
if ($null -eq $AppName) { $AppName = Get-LanguageAppName $Language }
if ($Port -eq 0) { $Port = Get-LanguagePort $Language }

Write-StepHeader "Build Docker Image" "06"

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
Write-StepSuccess "Docker is running"

# Build Docker image
Write-Host "Building Docker image..." -ForegroundColor Green
aifabrix build $AppName
if ($LASTEXITCODE -ne 0) {
    Write-StepError "Docker build failed"
    exit 1
}

# Verify image exists
$imageExists = docker images --filter "reference=${AppName}:latest" --format "{{.Repository}}:{{.Tag}}" 2>&1
if ($imageExists -match "${AppName}:latest") {
    Write-StepSuccess "Docker image built: ${AppName}:latest"
} else {
    Write-StepError "Docker image not found"
    exit 1
}

Write-StepSuccess "Step 06 completed successfully"
exit 0

