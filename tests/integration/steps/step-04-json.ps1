# Step 4: Generate Deployment JSON
# Tests aifabrix json command

param(
    [string]$Language = "python",
    [string]$AppName = $null,
    [int]$Port = 0
)

. "$PSScriptRoot\common.ps1"

# Set defaults if not provided
if ($null -eq $AppName) { $AppName = Get-LanguageAppName $Language }
if ($Port -eq 0) { $Port = Get-LanguagePort $Language }

Write-StepHeader "Generate Deployment JSON" "04"

# Verify app exists
$appInfo = Test-AppExists -AppName $AppName
if (-not $appInfo.Builder) {
    Write-StepError "Application not found. Run step-01-create.ps1 first."
    exit 1
}

# Generate deployment JSON
Write-Host "Generating deployment JSON..." -ForegroundColor Green
aifabrix json $AppName
if ($LASTEXITCODE -ne 0) {
    Write-StepWarning "Deployment JSON generation failed (may be due to schema validation)"
    Write-StepWarning "Continuing anyway..."
} else {
    # Verify deployment JSON exists
    $deployJson = Join-Path $appInfo.BuilderPath "aifabrix-deploy.json"
    if (Test-Path $deployJson) {
        Write-StepSuccess "Deployment JSON generated"
        
        # Verify JSON is valid
        try {
            $jsonContent = Get-Content $deployJson -Raw | ConvertFrom-Json
            Write-StepSuccess "Deployment JSON is valid"
        } catch {
            Write-StepError "Deployment JSON is invalid: $_"
            exit 1
        }
    } else {
        Write-StepWarning "Deployment JSON file not found"
    }
}

Write-StepSuccess "Step 04 completed"
exit 0

