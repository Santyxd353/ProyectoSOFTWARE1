[CmdletBinding()]
param(
    [string] $RepositoryRoot,
    [string] $PostgresBin,
    [switch] $Plan,
    [switch] $SkipDependencies
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'local-dev-common.ps1')

if (-not $RepositoryRoot) {
    $RepositoryRoot = Split-Path $PSScriptRoot -Parent
}
$config = Get-LocalDevConfiguration -RepositoryRoot $RepositoryRoot
$resolvedPostgresBin = Resolve-PostgresBin -OverridePath $PostgresBin
$willInitialize = -not (Test-Path -LiteralPath (Join-Path $config.PostgresDataDirectory 'PG_VERSION'))

if ($Plan) {
    [pscustomobject]@{
        RepositoryRoot = $config.RepositoryRoot
        PostgresBin = $resolvedPostgresBin
        PostgresPort = $config.PostgresPort
        BackendPort = $config.BackendPort
        FrontendPort = $config.FrontendPort
        DatabaseName = $config.DatabaseName
        WillInitializeDatabase = $willInitialize
    } | ConvertTo-Json -Compress
    exit 0
}

$npm = Get-Command npm.cmd -ErrorAction Stop
$npx = Get-Command npx.cmd -ErrorAction Stop
$null = New-Item -ItemType Directory -Path $config.LocalDirectory -Force
$null = New-Item -ItemType Directory -Path $config.LogDirectory -Force
$null = New-Item -ItemType Directory -Path $config.RuntimeDirectory -Force
$secrets = Get-OrCreateLocalSecrets -Config $config

if ($willInitialize) {
    Write-Host 'Inicializando PostgreSQL local aislado...'
    $passwordFile = Join-Path $config.LocalDirectory 'initdb-password.tmp'
    try {
        [IO.File]::WriteAllText($passwordFile, $secrets.DatabasePassword)
        & (Join-Path $resolvedPostgresBin 'initdb.exe') `
            "--pgdata=$($config.PostgresDataDirectory)" `
            "--username=$($config.DatabaseUser)" `
            '--encoding=UTF8' `
            '--auth-local=trust' `
            '--auth-host=scram-sha-256' `
            "--pwfile=$passwordFile"
        if ($LASTEXITCODE -ne 0) {
            throw "initdb terminó con código $LASTEXITCODE."
        }
    } finally {
        if (Test-Path -LiteralPath $passwordFile) {
            [IO.File]::Delete($passwordFile)
        }
    }
}

& (Join-Path $resolvedPostgresBin 'pg_ctl.exe') status -D $config.PostgresDataDirectory *> $null
$postgresRunning = $LASTEXITCODE -eq 0
if (-not $postgresRunning) {
    Write-Host "Iniciando PostgreSQL en 127.0.0.1:$($config.PostgresPort)..."
    & (Join-Path $resolvedPostgresBin 'pg_ctl.exe') start `
        -D $config.PostgresDataDirectory `
        -l (Join-Path $config.LogDirectory 'postgres.log') `
        -o "-p $($config.PostgresPort) -h 127.0.0.1" `
        -w
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL no pudo iniciar; revisa .local/logs/postgres.log."
    }
}

$previousPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $secrets.DatabasePassword
    $databaseExists = & (Join-Path $resolvedPostgresBin 'psql.exe') `
        -h 127.0.0.1 `
        -p $config.PostgresPort `
        -U $config.DatabaseUser `
        -d postgres `
        -tAc "SELECT 1 FROM pg_database WHERE datname = '$($config.DatabaseName)'"
    if ($LASTEXITCODE -ne 0) {
        throw 'No fue posible consultar PostgreSQL local.'
    }
    if (($databaseExists | Out-String).Trim() -ne '1') {
        & (Join-Path $resolvedPostgresBin 'createdb.exe') `
            -h 127.0.0.1 `
            -p $config.PostgresPort `
            -U $config.DatabaseUser `
            $config.DatabaseName
        if ($LASTEXITCODE -ne 0) {
            throw "No fue posible crear la base $($config.DatabaseName)."
        }
    }
} finally {
    $env:PGPASSWORD = $previousPassword
}

Write-LocalEnvironmentFiles `
    -Config $config `
    -DatabasePassword $secrets.DatabasePassword `
    -JwtSecret $secrets.JwtSecret

foreach ($application in @('backend', 'frontend')) {
    $applicationPath = Join-Path $config.RepositoryRoot $application
    if (-not $SkipDependencies -and -not (Test-Path -LiteralPath (Join-Path $applicationPath 'node_modules'))) {
        Write-Host "Instalando dependencias de $application..."
        & $npm.Source ci --prefix $applicationPath
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci falló para $application."
        }
    }
}

Write-Host 'Generando cliente Prisma y aplicando migraciones...'
Push-Location (Join-Path $config.RepositoryRoot 'backend')
try {
    & $npx.Source prisma generate
    if ($LASTEXITCODE -ne 0) { throw 'prisma generate falló.' }
    & $npx.Source prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'prisma migrate deploy falló.' }
} finally {
    Pop-Location
}

Write-Host ''
Write-Host 'Entorno local preparado.' -ForegroundColor Green
Write-Host "Base de datos: 127.0.0.1:$($config.PostgresPort)/$($config.DatabaseName)"
Write-Host 'Siguiente paso: .\scripts\start-local.ps1'
