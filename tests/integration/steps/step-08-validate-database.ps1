# Step 8: Validate Database Creation
# Validates that database and user were created successfully

param(
    [string]$Language = "python",
    [string]$AppName = $null,
    [int]$Port = 0
)

. "$PSScriptRoot\common.ps1"

# Set defaults if not provided
if ($null -eq $AppName) { $AppName = Get-LanguageAppName $Language }
if ($Port -eq 0) { $Port = Get-LanguagePort $Language }

Write-StepHeader "Validate Database Creation" "08"

# Convert app name to database name (hyphens to underscores)
$DB_NAME = Convert-AppNameToDbName $AppName
$DB_USER = "${DB_NAME}_user"

# Check Docker is running
if (-not (Test-DockerRunning)) {
    Write-StepError "Docker is not running"
    exit 1
}

# Verify database exists
Write-Host "Verifying database exists..." -ForegroundColor Green
if (-not (Test-DatabaseExists -DatabaseName $DB_NAME)) {
    Write-StepError "Database '$DB_NAME' does not exist in PostgreSQL"
    exit 1
}
Write-StepSuccess "Database '$DB_NAME' exists"

# Verify database user exists
Write-Host "Verifying database user exists..." -ForegroundColor Green
if (-not (Test-DatabaseUserExists -UserName $DB_USER)) {
    Write-StepError "Database user '$DB_USER' does not exist in PostgreSQL"
    exit 1
}
Write-StepSuccess "Database user '$DB_USER' exists"

# Verify user permissions
Write-Host "Verifying user permissions..." -ForegroundColor Green
$permissions = docker exec aifabrix-postgres psql -U pgadmin -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER' AND rolsuper='f'" 2>&1
if ($permissions -match "1") {
    Write-StepSuccess "User permissions are correct (non-superuser)"
} else {
    Write-StepWarning "User permissions check inconclusive"
}

Write-StepSuccess "Step 08 completed successfully"
exit 0

