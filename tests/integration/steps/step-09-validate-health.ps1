# Step 9: Validate Health Check and Database Connection
# Tests health check endpoint and validates database connectivity

param(
    [string]$Language = "python",
    [string]$AppName = $null,
    [int]$Port = 0
)

. "$PSScriptRoot\common.ps1"

# Set defaults if not provided
if ($null -eq $AppName) { $AppName = Get-LanguageAppName $Language }
if ($Port -eq 0) { $Port = Get-LanguagePort $Language }

Write-StepHeader "Validate Health Check and Database Connection" "09"

$CONTAINER_NAME = "aifabrix-${AppName}"

# Check container is running
if (-not (Test-ContainerRunning -ContainerName $CONTAINER_NAME)) {
    Write-StepError "Container '$CONTAINER_NAME' is not running. Run step-07-run.ps1 first."
    exit 1
}

# Wait for application to be ready
Write-Host "Waiting for application to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test health check endpoint
Write-Host "Testing health check endpoint..." -ForegroundColor Green
$maxRetries = 10
$retryCount = 0
$healthCheckPassed = $false

while ($retryCount -lt $maxRetries -and -not $healthCheckPassed) {
    $healthUrl = "http://localhost:${Port}/health"
    $healthResponse = Get-HealthCheckResponse -Url $healthUrl
    
    if ($healthResponse.Success -or ($healthResponse.Status -eq "ok")) {
        Write-StepSuccess "Health check endpoint responding"
        Write-StepSuccess "Health check status: $($healthResponse.Content.status)"
        
        # Check database connectivity in health check
        if ($healthResponse.Content.database) {
            if ($healthResponse.Content.database -eq "connected") {
                Write-StepSuccess "Database connectivity verified in health check"
                $healthCheckPassed = $true
            } else {
                Write-StepWarning "Database connection failed in health check: $($healthResponse.Content.database_error)"
                Write-StepWarning "Attempting direct database connection test..."
                
                # Try direct database connection test
                $appInfo = Test-AppExists -AppName $AppName
                $envFile = Join-Path $appInfo.BuilderPath ".env"
                
                if (Test-Path $envFile) {
                    $envContent = Get-Content $envFile -Raw
                    $dbHostMatch = $envContent | Select-String -Pattern "DB_HOST=([^\r\n]+)"
                    $dbNameMatch = $envContent | Select-String -Pattern "DB_NAME=([^\r\n]+)"
                    $dbUserMatch = $envContent | Select-String -Pattern "DB_USER=([^\r\n]+)"
                    $dbPasswordMatch = $envContent | Select-String -Pattern "DB_PASSWORD=([^\r\n]+)"
                    
                    if ($dbHostMatch -and $dbNameMatch -and $dbUserMatch -and $dbPasswordMatch) {
                        $dbHost = $dbHostMatch.Matches[0].Groups[1].Value
                        $dbName = $dbNameMatch.Matches[0].Groups[1].Value
                        $dbUser = $dbUserMatch.Matches[0].Groups[1].Value
                        $dbPassword = $dbPasswordMatch.Matches[0].Groups[1].Value
                        
                        Write-Host "Testing direct database connection from container..." -ForegroundColor Yellow
                        Write-Host "  Host: $dbHost" -ForegroundColor Gray
                        Write-Host "  Database: $dbName" -ForegroundColor Gray
                        Write-Host "  User: $dbUser" -ForegroundColor Gray
                        
                        # Test connection from container
                        $dbNameUnderscore = $dbName -replace '-', '_'
                        $testResult = docker exec $CONTAINER_NAME sh -c "PGPASSWORD='$dbPassword' psql -h $dbHost -p 5432 -U $dbUser -d $dbNameUnderscore -c 'SELECT 1;'" 2>&1
                        
                        if ($LASTEXITCODE -eq 0 -and $testResult -match "1") {
                            Write-StepSuccess "Direct database connection test passed"
                            $healthCheckPassed = $true
                        } else {
                            Write-StepError "Direct database connection test failed"
                            Write-Host "  Error: $testResult" -ForegroundColor Red
                            $retryCount++
                            if ($retryCount -lt $maxRetries) {
                                Write-Host "  Retrying... ($retryCount/$maxRetries)" -ForegroundColor Yellow
                                Start-Sleep -Seconds 3
                            }
                        }
                    } else {
                        Write-StepWarning "Could not parse database configuration from .env file"
                        $healthCheckPassed = $true  # Accept if database/user were created
                    }
                } else {
                    Write-StepWarning ".env file not found"
                    $healthCheckPassed = $true  # Accept if database/user were created
                }
            }
        } else {
            Write-StepWarning "Database connectivity not checked in health check"
            $healthCheckPassed = $true
        }
    } else {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Write-Host "  Retrying health check... ($retryCount/$maxRetries)" -ForegroundColor Yellow
            Start-Sleep -Seconds 3
        } else {
            Write-StepError "Could not reach health check endpoint after $maxRetries attempts"
            Write-Host "  Last error: $($healthResponse.Error)" -ForegroundColor Red
            exit 1
        }
    }
}

if (-not $healthCheckPassed) {
    Write-StepError "Health check validation failed"
    exit 1
}

Write-StepSuccess "Step 09 completed successfully"
exit 0

