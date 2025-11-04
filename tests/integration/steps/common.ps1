# Common utilities for step-by-step tests
# Shared functions used across all test steps

$ErrorActionPreference = "Stop"

# Ensure we're running from the project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $scriptPath))
Set-Location $projectRoot

function Test-AppExists {
    param([string]$AppName)
    
    $builderPath = Join-Path "builder" $AppName
    $appsPath = Join-Path "apps" $AppName
    
    $builderExists = Test-Path $builderPath
    $appsExists = Test-Path $appsPath
    
    return @{
        Builder = $builderExists
        Apps = $appsExists
        BuilderPath = $builderPath
        AppsPath = $appsPath
    }
}

function Test-FileExists {
    param([string]$FilePath)
    
    return Test-Path $FilePath
}

function Test-DockerRunning {
    docker ps 2>&1 | Out-Null
    return $LASTEXITCODE -eq 0
}

function Test-InfrastructureRunning {
    aifabrix status 2>&1 | Out-Null
    return $LASTEXITCODE -eq 0
}

function Get-HealthCheckResponse {
    param(
        [string]$Url = "http://localhost:3090/health",
        [int]$TimeoutSec = 5
    )
    
    try {
        $response = Invoke-RestMethod -Uri $Url -TimeoutSec $TimeoutSec -ErrorAction Stop
        return @{
            Success = $true
            Status = "ok"
            Content = $response
        }
    } catch {
        $errorResponse = $_.ErrorDetails.Message
        if ($errorResponse) {
            try {
                $content = $errorResponse | ConvertFrom-Json
                return @{
                    Success = $false
                    Status = $content.status
                    Content = $content
                    Error = $_.Exception.Message
                }
            } catch {
                return @{
                    Success = $false
                    Status = "error"
                    Content = $null
                    Error = $_.Exception.Message
                }
            }
        } else {
            return @{
                Success = $false
                Status = "error"
                Content = $null
                Error = $_.Exception.Message
            }
        }
    }
}

function Test-DatabaseExists {
    param(
        [string]$DatabaseName,
        [string]$ContainerName = "aifabrix-postgres"
    )
    
    $result = docker exec $ContainerName psql -U pgadmin -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DatabaseName'" 2>&1
    return $result -match "1"
}

function Test-DatabaseUserExists {
    param(
        [string]$UserName,
        [string]$ContainerName = "aifabrix-postgres"
    )
    
    $result = docker exec $ContainerName psql -U pgadmin -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$UserName'" 2>&1
    return $result -match "1"
}

function Test-ContainerRunning {
    param([string]$ContainerName)
    
    $result = docker ps --filter "name=$ContainerName" --format "{{.Names}}" 2>&1
    return $result -match $ContainerName
}

function Test-DatabaseConnection {
    param(
        [string]$ContainerName,
        [string]$Host = "postgres",
        [string]$Port = "5432",
        [string]$Database,
        [string]$User,
        [string]$Password
    )
    
    # Test connection from container using psql
    $command = "PGPASSWORD='$Password' psql -h $Host -p $Port -U $User -d $Database -c 'SELECT 1;'"
    $result = docker exec $ContainerName sh -c $command 2>&1
    return $LASTEXITCODE -eq 0 -and $result -match "1"
}

function Write-StepHeader {
    param([string]$StepName, [string]$StepNumber)
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Step $StepNumber : $StepName" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-StepSuccess {
    param([string]$Message)
    
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-StepError {
    param([string]$Message)
    
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-StepWarning {
    param([string]$Message)
    
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

# Language-specific helper functions

function Get-LanguageAppName {
    param([string]$Language)
    
    switch ($Language.ToLower()) {
        "python" { return "test-py-app" }
        "typescript" { return "test-ts-app" }
        default { 
            Write-StepWarning "Unknown language '$Language', defaulting to Python"
            return "test-py-app"
        }
    }
}

function Get-LanguagePort {
    param([string]$Language)
    
    switch ($Language.ToLower()) {
        "python" { return 3090 }
        "typescript" { return 3091 }
        default { 
            Write-StepWarning "Unknown language '$Language', defaulting to port 3090"
            return 3090
        }
    }
}

function Get-LanguageFiles {
    param([string]$Language)
    
    switch ($Language.ToLower()) {
        "python" { 
            return @{
                SourceFiles = @("requirements.txt", "main.py")
                SourceFileNames = @("requirements.txt", "main.py")
            }
        }
        "typescript" { 
            return @{
                SourceFiles = @("package.json", "index.ts")
                SourceFileNames = @("package.json", "index.ts")
            }
        }
        default { 
            Write-StepWarning "Unknown language '$Language', defaulting to Python files"
            return @{
                SourceFiles = @("requirements.txt", "main.py")
                SourceFileNames = @("requirements.txt", "main.py")
            }
        }
    }
}

function Get-LanguageDockerfilePattern {
    param([string]$Language)
    
    switch ($Language.ToLower()) {
        "python" { return "FROM python" }
        "typescript" { return "FROM node" }
        default { 
            Write-StepWarning "Unknown language '$Language', defaulting to Python pattern"
            return "FROM python"
        }
    }
}

function Convert-AppNameToDbName {
    param([string]$AppName)
    
    # Convert hyphens to underscores for PostgreSQL database names
    return $AppName -replace '-', '_'
}

