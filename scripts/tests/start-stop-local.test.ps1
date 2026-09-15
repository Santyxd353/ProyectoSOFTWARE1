$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) "proyecto-software1-start-test-$([Guid]::NewGuid().ToString('N'))"

try {
    foreach ($path in @(
        'backend\node_modules',
        'frontend\node_modules',
        '.local\postgres-data',
        '.local\runtime'
    )) {
        $null = New-Item -ItemType Directory -Path (Join-Path $fixtureRoot $path) -Force
    }
    [IO.File]::WriteAllText((Join-Path $fixtureRoot '.local\postgres-data\PG_VERSION'), '18')
    [IO.File]::WriteAllText((Join-Path $fixtureRoot 'backend\.env'), 'PORT=3002')
    [IO.File]::WriteAllText((Join-Path $fixtureRoot 'frontend\.env.local'), 'NEXT_PUBLIC_API_URL=http://localhost:3002/api')
    foreach ($application in @('backend', 'frontend')) {
        $lockPath = Join-Path $fixtureRoot "$application\package-lock.json"
        [IO.File]::WriteAllText($lockPath, "${application}-lock-v1")
        $lockHash = (Get-FileHash -LiteralPath $lockPath -Algorithm SHA256).Hash
        [IO.File]::WriteAllText(
            (Join-Path $fixtureRoot "$application\node_modules\.puds-package-lock.sha256"),
            $lockHash
        )
    }

    $startScript = Join-Path $PSScriptRoot '..\start-local.ps1'
    $startPlan = (& $startScript -RepositoryRoot $fixtureRoot -Plan) | ConvertFrom-Json
    if ($startPlan.RequiresSetup) {
        throw 'Prepared fixtures must not require setup.'
    }
    if ($startPlan.WebUrl -ne 'http://localhost:3000' -or $startPlan.ApiUrl -ne 'http://localhost:3002/api') {
        throw 'Start plan exposed incorrect local URLs.'
    }

    [IO.File]::WriteAllText((Join-Path $fixtureRoot 'backend\package-lock.json'), 'backend-lock-v2')
    $staleDependencyPlan = (& $startScript -RepositoryRoot $fixtureRoot -Plan) | ConvertFrom-Json
    if (-not $staleDependencyPlan.RequiresSetup) {
        throw 'A changed package lock must require dependency setup.'
    }

    $stopScript = Join-Path $PSScriptRoot '..\stop-local.ps1'
    $stopPlan = (& $stopScript -RepositoryRoot $fixtureRoot -Plan) | ConvertFrom-Json
    if ($stopPlan.BackendPidPath -ne [IO.Path]::GetFullPath((Join-Path $fixtureRoot '.local\runtime\backend.pid'))) {
        throw 'Stop plan exposed an incorrect backend PID path.'
    }
    if ($stopPlan.PostgresDataDirectory -ne [IO.Path]::GetFullPath((Join-Path $fixtureRoot '.local\postgres-data'))) {
        throw 'Stop plan exposed an incorrect PostgreSQL data path.'
    }

    Write-Output 'PASS start-stop-local plans'
} finally {
    if (Test-Path -LiteralPath $fixtureRoot) {
        ([IO.DirectoryInfo]::new($fixtureRoot)).Delete($true)
    }
}
