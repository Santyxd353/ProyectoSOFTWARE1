[CmdletBinding()]
param(
    [string] $RepositoryRoot,
    [switch] $Plan
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'local-dev-common.ps1')

if (-not $RepositoryRoot) {
    $RepositoryRoot = Split-Path $PSScriptRoot -Parent
}
$config = Get-LocalDevConfiguration -RepositoryRoot $RepositoryRoot
$backendPidPath = Join-Path $config.RuntimeDirectory 'backend.pid'
$frontendPidPath = Join-Path $config.RuntimeDirectory 'frontend.pid'

if ($Plan) {
    [pscustomobject]@{
        BackendPidPath = [IO.Path]::GetFullPath($backendPidPath)
        FrontendPidPath = [IO.Path]::GetFullPath($frontendPidPath)
        PostgresDataDirectory = [IO.Path]::GetFullPath($config.PostgresDataDirectory)
    } | ConvertTo-Json -Compress
    exit 0
}

$processSnapshot = @(Get-CimInstance Win32_Process)
foreach ($pidPath in @($frontendPidPath, $backendPidPath)) {
    if (-not (Test-Path -LiteralPath $pidPath)) {
        continue
    }

    $recordedPid = [int]([IO.File]::ReadAllText($pidPath).Trim())
    $processIds = [Collections.Generic.HashSet[int]]::new()
    $null = $processIds.Add($recordedPid)
    do {
        $countBefore = $processIds.Count
        foreach ($candidate in $processSnapshot) {
            if ($processIds.Contains([int]$candidate.ParentProcessId)) {
                $null = $processIds.Add([int]$candidate.ProcessId)
            }
        }
    } until ($processIds.Count -eq $countBefore)

    $orderedIds = @($processIds) | Sort-Object -Descending
    foreach ($processId in $orderedIds) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    [IO.File]::Delete($pidPath)
}

if (Test-Path -LiteralPath (Join-Path $config.PostgresDataDirectory 'PG_VERSION')) {
    $postgresBin = Resolve-PostgresBin
    & (Join-Path $postgresBin 'pg_ctl.exe') status -D $config.PostgresDataDirectory *> $null
    if ($LASTEXITCODE -eq 0) {
        & (Join-Path $postgresBin 'pg_ctl.exe') stop -D $config.PostgresDataDirectory -m fast -w
        if ($LASTEXITCODE -ne 0) {
            throw 'PostgreSQL local no pudo detenerse.'
        }
    }
}

Write-Host 'Servicios locales detenidos.' -ForegroundColor Green
