# Step 3: Resolve Secrets
# Tests aifabrix resolve command with and without --force

param(
    [string]$Language = "python",
    [string]$AppName = $null,
    [int]$Port = 0
)

. "$PSScriptRoot\common.ps1"

# Set defaults if not provided
if ($null -eq $AppName) { $AppName = Get-LanguageAppName $Language }
if ($Port -eq 0) { $Port = Get-LanguagePort $Language }

Write-StepHeader "Resolve Secrets" "03"

# Verify app exists
$appInfo = Test-AppExists -AppName $AppName
if (-not $appInfo.Builder) {
    Write-StepError "Application not found. Run step-01-create.ps1 first."
    exit 1
}

# Test resolve without --force (may fail gracefully)
Write-Host "Testing resolve without --force..." -ForegroundColor Green
aifabrix resolve $AppName 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-StepWarning "Resolve without --force failed (expected if secrets missing)"
} else {
    Write-StepSuccess "Resolve without --force succeeded"
}

# Test resolve with --force
Write-Host "Testing resolve with --force..." -ForegroundColor Green
aifabrix resolve $AppName --force
if ($LASTEXITCODE -ne 0) {
    Write-StepError "Resolve with --force failed"
    exit 1
}

# Verify .env file in builder
$envFile = Join-Path $appInfo.BuilderPath ".env"
if (-not (Test-Path $envFile)) {
    Write-StepError ".env file not generated in builder/$AppName/"
    exit 1
}
Write-StepSuccess ".env file generated in builder/"

# Verify .env file in apps (if envOutputPath is set)
$appsEnvFile = Join-Path $appInfo.AppsPath ".env"
if (Test-Path $appsEnvFile) {
    Write-StepSuccess ".env file copied to apps/$AppName/"
} else {
    Write-StepWarning ".env file not copied to apps/ (may not be configured)"
}

# Verify .env file contains database variables
$envContent = Get-Content $envFile -Raw
if ($envContent -notmatch "DB_HOST") {
    Write-StepError ".env file does not contain DB_HOST"
    exit 1
}
Write-StepSuccess ".env file contains database configuration"

Write-StepSuccess "Step 03 completed successfully"
exit 0

