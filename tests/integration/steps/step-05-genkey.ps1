# Step 5: Generate Deployment Key
# Tests aifabrix genkey command

param(
    [string]$Language = "python",
    [string]$AppName = $null,
    [int]$Port = 0
)

. "$PSScriptRoot\common.ps1"

# Set defaults if not provided
if ($null -eq $AppName) { $AppName = Get-LanguageAppName $Language }
if ($Port -eq 0) { $Port = Get-LanguagePort $Language }

Write-StepHeader "Generate Deployment Key" "05"

# Verify app exists
$appInfo = Test-AppExists -AppName $AppName
if (-not $appInfo.Builder) {
    Write-StepError "Application not found. Run step-01-create.ps1 first."
    exit 1
}

# Generate deployment key
Write-Host "Generating deployment key..." -ForegroundColor Green
aifabrix genkey $AppName
if ($LASTEXITCODE -ne 0) {
    Write-StepError "Deployment key generation failed"
    exit 1
}

Write-StepSuccess "Deployment key generated"

Write-StepSuccess "Step 05 completed successfully"
exit 0

