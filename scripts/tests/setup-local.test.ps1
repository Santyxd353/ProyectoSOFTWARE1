$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) "proyecto-software1-setup-test-$([Guid]::NewGuid().ToString('N'))"

try {
    $null = New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'backend') -Force
    $null = New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'frontend') -Force
    $fakePostgres = Join-Path $fixtureRoot 'postgres-bin'
    $null = New-Item -ItemType Directory -Path $fakePostgres -Force
    foreach ($executable in @('initdb.exe', 'pg_ctl.exe', 'createdb.exe', 'psql.exe')) {
        [IO.File]::WriteAllText((Join-Path $fakePostgres $executable), '')
    }

    $setupScript = Join-Path $PSScriptRoot '..\setup-local.ps1'
    $plan = (& $setupScript -RepositoryRoot $fixtureRoot -PostgresBin $fakePostgres -Plan) | ConvertFrom-Json

    if ($plan.PostgresPort -ne 55432 -or $plan.BackendPort -ne 3002 -or $plan.FrontendPort -ne 3000) {
        throw 'Setup plan exposed unexpected ports.'
    }
    if ($plan.PostgresBin -ne [IO.Path]::GetFullPath($fakePostgres)) {
        throw 'Setup plan did not use the requested PostgreSQL installation.'
    }
    if (-not $plan.WillInitializeDatabase) {
        throw 'A fresh local setup must initialize its isolated database.'
    }
    if (Test-Path -LiteralPath (Join-Path $fixtureRoot '.local')) {
        throw 'Plan mode must not modify the repository.'
    }

    Write-Output 'PASS setup-local plan'
} finally {
    if (Test-Path -LiteralPath $fixtureRoot) {
        ([IO.DirectoryInfo]::new($fixtureRoot)).Delete($true)
    }
}
