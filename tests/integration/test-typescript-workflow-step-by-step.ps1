# TypeScript Workflow Step-by-Step Integration Test
# Wrapper script that calls the generic test script with TypeScript language

param(
    [string]$AppName = $null,
    [int]$Port = 0
)

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Build parameter hashtable for splatting
$params = @{
    Language = "typescript"
}
if ($null -ne $AppName) { $params.AppName = $AppName }
if ($Port -ne 0) { $params.Port = $Port }

# Call the generic script using splatting
& "$scriptPath\test-workflow-step-by-step.ps1" @params

exit $LASTEXITCODE

