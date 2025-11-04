# Step 2: Generate Dockerfile
# Tests aifabrix dockerfile command

param(
    [string]$Language = "python",
    [string]$AppName = $null,
    [int]$Port = 0
)

. "$PSScriptRoot\common.ps1"

# Set defaults if not provided
if ($null -eq $AppName) { $AppName = Get-LanguageAppName $Language }
if ($Port -eq 0) { $Port = Get-LanguagePort $Language }

Write-StepHeader "Generate Dockerfile" "02"

# Verify app exists
$appInfo = Test-AppExists -AppName $AppName
if (-not $appInfo.Builder) {
    Write-StepError "Application not found. Run step-01-create.ps1 first."
    exit 1
}

# Generate Dockerfile
Write-Host "Generating Dockerfile..." -ForegroundColor Green
aifabrix dockerfile $AppName
if ($LASTEXITCODE -ne 0) {
    Write-StepError "Dockerfile generation failed"
    exit 1
}

# Verify Dockerfile exists
$dockerfile = Join-Path $appInfo.BuilderPath "Dockerfile"
if (-not (Test-Path $dockerfile)) {
    Write-StepError "Dockerfile not generated"
    exit 1
}
Write-StepSuccess "Dockerfile generated"

# Verify Dockerfile content based on language
$dockerfileContent = Get-Content $dockerfile -Raw
$dockerfilePattern = Get-LanguageDockerfilePattern $Language
if ($dockerfileContent -notmatch $dockerfilePattern) {
    Write-StepError "Dockerfile does not contain expected base image pattern: $dockerfilePattern"
    exit 1
}
Write-StepSuccess "Dockerfile contains expected base image pattern"

Write-StepSuccess "Step 02 completed successfully"
exit 0

