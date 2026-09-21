$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot '..\local-dev-common.ps1')

function Assert-Equal {
    param(
        [Parameter(Mandatory)] $Actual,
        [Parameter(Mandatory)] $Expected,
        [Parameter(Mandatory)] [string] $Message
    )

    if ($Actual -ne $Expected) {
        throw "$Message. Expected '$Expected', received '$Actual'."
    }
}

function Assert-Contains {
    param(
        [Parameter(Mandatory)] [string] $Text,
        [Parameter(Mandatory)] [string] $Expected,
        [Parameter(Mandatory)] [string] $Message
    )

    if (-not $Text.Contains($Expected)) {
        throw "$Message. Missing '$Expected'."
    }
}

$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) "proyecto-software1-script-test-$([Guid]::NewGuid().ToString('N'))"

try {
    $null = New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'backend') -Force
    $null = New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'frontend') -Force
    $fakePostgres = Join-Path $fixtureRoot 'postgres-bin'
    $null = New-Item -ItemType Directory -Path $fakePostgres -Force
    foreach ($executable in @('initdb.exe', 'pg_ctl.exe', 'createdb.exe', 'psql.exe')) {
        [IO.File]::WriteAllText((Join-Path $fakePostgres $executable), '')
    }

    $config = Get-LocalDevConfiguration -RepositoryRoot $fixtureRoot
    Assert-Equal $config.PostgresPort 55432 'Local PostgreSQL port changed unexpectedly'
    Assert-Equal $config.BackendPort 3002 'Backend port changed unexpectedly'
    Assert-Equal $config.FrontendPort 3000 'Frontend port changed unexpectedly'

    $resolvedPostgres = Resolve-PostgresBin -OverridePath $fakePostgres
    Assert-Equal $resolvedPostgres ([IO.Path]::GetFullPath($fakePostgres)) 'Explicit PostgreSQL path was not honored'

    $backendPath = Join-Path $fixtureRoot 'backend'
    $nodeModulesPath = Join-Path $backendPath 'node_modules'
    $lockPath = Join-Path $backendPath 'package-lock.json'
    $null = New-Item -ItemType Directory -Path $nodeModulesPath -Force
    [IO.File]::WriteAllText($lockPath, '{"lockfileVersion":3}')

    function Get-FileHash { throw 'Dependency markers must not require the Get-FileHash cmdlet.' }
    Write-ApplicationDependencyMarker -ApplicationPath $backendPath
    if (-not (Test-ApplicationDependenciesCurrent -ApplicationPath $backendPath)) {
        throw 'Dependency marker should match the current lock file without Get-FileHash.'
    }
    [IO.File]::AppendAllText($lockPath, [Environment]::NewLine)
    if (Test-ApplicationDependenciesCurrent -ApplicationPath $backendPath) {
        throw 'Dependency marker must detect a changed lock file.'
    }
    Remove-Item Function:\Get-FileHash

    $firstSecrets = Get-OrCreateLocalSecrets -Config $config
    $secondSecrets = Get-OrCreateLocalSecrets -Config $config
    Assert-Equal $secondSecrets.DatabasePassword $firstSecrets.DatabasePassword 'Database password must remain stable'
    Assert-Equal $secondSecrets.JwtSecret $firstSecrets.JwtSecret 'JWT secret must remain stable'
    if ($firstSecrets.DatabasePassword.Length -lt 32 -or $firstSecrets.JwtSecret.Length -lt 32) {
        throw 'Generated local secrets must contain at least 32 characters.'
    }

    Write-LocalEnvironmentFiles `
        -Config $config `
        -DatabasePassword 'P@ss word' `
        -JwtSecret 'jwt-test-secret'

    $backendEnvironment = [IO.File]::ReadAllText($config.BackendEnvironmentPath)
    $frontendEnvironment = [IO.File]::ReadAllText($config.FrontendEnvironmentPath)

    Assert-Contains $backendEnvironment 'postgresql://postgres:P%40ss%20word@127.0.0.1:55432/uml_platform_local?schema=public' 'Database URL was not safely encoded'
    Assert-Contains $backendEnvironment 'JWT_SECRET="jwt-test-secret"' 'JWT secret was not written'
    Assert-Contains $backendEnvironment 'ARTIFACT_STORAGE_PATH="./artifacts"' 'Artifact storage path is missing'
    Assert-Contains $frontendEnvironment 'NEXT_PUBLIC_API_URL=http://localhost:3002/api' 'Frontend API URL is incorrect'
    Assert-Contains $frontendEnvironment 'NEXT_PUBLIC_WS_URL=http://localhost:3002' 'Frontend WebSocket URL is incorrect'

    Write-Output 'PASS local-dev-common'
} finally {
    if (Test-Path -LiteralPath $fixtureRoot) {
        ([IO.DirectoryInfo]::new($fixtureRoot)).Delete($true)
    }
}
