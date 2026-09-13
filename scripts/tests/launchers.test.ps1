$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$startOutput = & cmd.exe /d /c (Join-Path $repositoryRoot 'INICIAR_LOCAL.cmd') -Plan
if ($LASTEXITCODE -ne 0) {
    throw 'INICIAR_LOCAL.cmd did not forward arguments to start-local.ps1.'
}
$startPlan = ($startOutput | Out-String).Trim() | ConvertFrom-Json
if ($startPlan.WebUrl -ne 'http://localhost:3000') {
    throw 'INICIAR_LOCAL.cmd returned an unexpected local URL.'
}

$stopOutput = & cmd.exe /d /c (Join-Path $repositoryRoot 'DETENER_LOCAL.cmd') -Plan
if ($LASTEXITCODE -ne 0) {
    throw 'DETENER_LOCAL.cmd did not forward arguments to stop-local.ps1.'
}
$stopPlan = ($stopOutput | Out-String).Trim() | ConvertFrom-Json
if (-not $stopPlan.PostgresDataDirectory.EndsWith('.local\postgres-data')) {
    throw 'DETENER_LOCAL.cmd returned an unexpected database path.'
}

Write-Output 'PASS local launchers'
