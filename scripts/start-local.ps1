[CmdletBinding()]
param(
    [string] $RepositoryRoot,
    [switch] $Plan,
    [switch] $OpenBrowser
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'local-dev-common.ps1')

if (-not $RepositoryRoot) {
    $RepositoryRoot = Split-Path $PSScriptRoot -Parent
}
$config = Get-LocalDevConfiguration -RepositoryRoot $RepositoryRoot
$requiredPaths = @(
    (Join-Path $config.PostgresDataDirectory 'PG_VERSION'),
    $config.BackendEnvironmentPath,
    $config.FrontendEnvironmentPath,
    (Join-Path $config.RepositoryRoot 'backend\node_modules'),
    (Join-Path $config.RepositoryRoot 'frontend\node_modules')
)
$requiresSetup = @($requiredPaths | Where-Object { -not (Test-Path -LiteralPath $_) }).Count -gt 0

if ($Plan) {
    [pscustomobject]@{
        RequiresSetup = $requiresSetup
        WebUrl = "http://localhost:$($config.FrontendPort)"
        ApiUrl = "http://localhost:$($config.BackendPort)/api"
        BackendPidPath = Join-Path $config.RuntimeDirectory 'backend.pid'
        FrontendPidPath = Join-Path $config.RuntimeDirectory 'frontend.pid'
    } | ConvertTo-Json -Compress
    exit 0
}

if ($requiresSetup) {
    & (Join-Path $PSScriptRoot 'setup-local.ps1') -RepositoryRoot $config.RepositoryRoot
}

$postgresBin = Resolve-PostgresBin
$null = New-Item -ItemType Directory -Path $config.LogDirectory -Force
$null = New-Item -ItemType Directory -Path $config.RuntimeDirectory -Force

& (Join-Path $postgresBin 'pg_ctl.exe') status -D $config.PostgresDataDirectory *> $null
if ($LASTEXITCODE -ne 0) {
    & (Join-Path $postgresBin 'pg_ctl.exe') start `
        -D $config.PostgresDataDirectory `
        -l (Join-Path $config.LogDirectory 'postgres.log') `
        -o "-p $($config.PostgresPort) -h 127.0.0.1" `
        -w
    if ($LASTEXITCODE -ne 0) {
        throw 'PostgreSQL local no pudo iniciar.'
    }
}

$npm = Get-Command npm.cmd -ErrorAction Stop
$services = @(
    [pscustomobject]@{
        Name = 'backend'
        Port = $config.BackendPort
        Command = 'start:dev'
        Directory = Join-Path $config.RepositoryRoot 'backend'
        PidPath = Join-Path $config.RuntimeDirectory 'backend.pid'
    },
    [pscustomobject]@{
        Name = 'frontend'
        Port = $config.FrontendPort
        Command = 'dev'
        Directory = Join-Path $config.RepositoryRoot 'frontend'
        PidPath = Join-Path $config.RuntimeDirectory 'frontend.pid'
    }
)

foreach ($service in $services) {
    $listener = Get-NetTCPConnection -LocalPort $service.Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        if (Test-Path -LiteralPath $service.PidPath) {
            Write-Host "$($service.Name) ya está activo en el puerto $($service.Port)."
            continue
        }
        throw "El puerto $($service.Port) está ocupado por otro proceso (PID $($listener.OwningProcess))."
    }

    $stdout = Join-Path $config.LogDirectory "$($service.Name).out.log"
    $stderr = Join-Path $config.LogDirectory "$($service.Name).err.log"
    $process = Start-Process `
        -FilePath $npm.Source `
        -ArgumentList @('run', $service.Command) `
        -WorkingDirectory $service.Directory `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -WindowStyle Hidden `
        -PassThru
    [IO.File]::WriteAllText($service.PidPath, [string]$process.Id)

    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    do {
        Start-Sleep -Milliseconds 500
        $listener = Get-NetTCPConnection -LocalPort $service.Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    } until ($listener -or [DateTime]::UtcNow -ge $deadline -or $process.HasExited)

    if (-not $listener) {
        $details = if (Test-Path -LiteralPath $stderr) { (Get-Content -LiteralPath $stderr -Tail 30) -join [Environment]::NewLine } else { 'Sin registro de error.' }
        throw "$($service.Name) no inició en el puerto $($service.Port).$([Environment]::NewLine)$details"
    }
    Write-Host "$($service.Name) activo en el puerto $($service.Port)."
}

$webUrl = "http://localhost:$($config.FrontendPort)"
Write-Host ''
Write-Host 'Sistema listo para pruebas locales.' -ForegroundColor Green
Write-Host "Web: $webUrl"
Write-Host "API: http://localhost:$($config.BackendPort)/api"
Write-Host 'Logs: .local\logs'
Write-Host 'Detener: .\scripts\stop-local.ps1'

if ($OpenBrowser) {
    Start-Process $webUrl
}
