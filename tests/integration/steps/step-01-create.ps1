# Step 1: Create Application
# Tests aifabrix create command with --app flag

param(
    [string]$Language = "python",
    [string]$AppName = $null,
    [int]$Port = 0
)

. "$PSScriptRoot\common.ps1"

# Set defaults if not provided
if ($null -eq $AppName) { $AppName = Get-LanguageAppName $Language }
if ($Port -eq 0) { $Port = Get-LanguagePort $Language }

Write-StepHeader "Create Application" "01"

# Clean up existing app if it exists
$appInfo = Test-AppExists -AppName $AppName
if ($appInfo.Builder) {
    Write-StepWarning "Cleaning up existing app in builder..."
    Remove-Item -Path $appInfo.BuilderPath -Recurse -Force
}
if ($appInfo.Apps) {
    Write-StepWarning "Cleaning up existing app in apps..."
    Remove-Item -Path $appInfo.AppsPath -Recurse -Force
}

# Create application
$languageDisplay = $Language.Substring(0,1).ToUpper() + $Language.Substring(1).ToLower()
Write-Host "Creating $languageDisplay application..." -ForegroundColor Green
aifabrix create $AppName --port $Port --database --redis --storage --authentication --language $Language --app
if ($LASTEXITCODE -ne 0) {
    Write-StepError "Application creation failed"
    exit 1
}

# Verify builder directory
if (-not (Test-Path $appInfo.BuilderPath)) {
    Write-StepError "Application directory not created in builder/"
    exit 1
}
Write-StepSuccess "Application directory created in builder/"

# Verify apps directory
if (-not (Test-Path $appInfo.AppsPath)) {
    Write-StepError "Application directory not created in apps/"
    exit 1
}
Write-StepSuccess "Application directory created in apps/"

# Verify application files based on language
$languageFiles = Get-LanguageFiles $Language
foreach ($fileName in $languageFiles.SourceFileNames) {
    $filePath = Join-Path $appInfo.AppsPath $fileName
    if (-not (Test-Path $filePath)) {
        Write-StepError "$fileName not found in apps/$AppName/"
        exit 1
    }
    Write-StepSuccess "$fileName found"
}

# Verify variables.yaml
$variablesYaml = Join-Path $appInfo.BuilderPath "variables.yaml"
if (-not (Test-Path $variablesYaml)) {
    Write-StepError "variables.yaml not found"
    exit 1
}
Write-StepSuccess "variables.yaml found"

Write-StepSuccess "Step 01 completed successfully"
exit 0

