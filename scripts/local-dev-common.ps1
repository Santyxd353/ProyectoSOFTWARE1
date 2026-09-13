Set-StrictMode -Version Latest

function Get-LocalDevConfiguration {
    param(
        [Parameter(Mandatory)] [string] $RepositoryRoot
    )

    $root = [IO.Path]::GetFullPath($RepositoryRoot)
    $localDirectory = Join-Path $root '.local'

    [pscustomobject]@{
        RepositoryRoot = $root
        LocalDirectory = $localDirectory
        PostgresDataDirectory = Join-Path $localDirectory 'postgres-data'
        LogDirectory = Join-Path $localDirectory 'logs'
        RuntimeDirectory = Join-Path $localDirectory 'runtime'
        SecretsPath = Join-Path $localDirectory 'secrets.json'
        BackendEnvironmentPath = Join-Path $root 'backend\.env'
        FrontendEnvironmentPath = Join-Path $root 'frontend\.env.local'
        PostgresPort = 55432
        DatabaseName = 'uml_platform_local'
        DatabaseUser = 'postgres'
        BackendPort = 3002
        FrontendPort = 3000
    }
}

function Resolve-PostgresBin {
    param(
        [string] $OverridePath
    )

    $candidates = [Collections.Generic.List[string]]::new()
    if ($OverridePath) {
        $candidates.Add($OverridePath)
    } elseif ($env:POSTGRES_BIN) {
        $candidates.Add($env:POSTGRES_BIN)
    } else {
        $postgresRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
        if (Test-Path -LiteralPath $postgresRoot) {
            Get-ChildItem -LiteralPath $postgresRoot -Directory |
                Sort-Object { try { [version]$_.Name } catch { [version]'0.0' } } -Descending |
                ForEach-Object { $candidates.Add((Join-Path $_.FullName 'bin')) }
        }
    }

    foreach ($candidate in $candidates) {
        $fullPath = [IO.Path]::GetFullPath($candidate)
        $required = @('initdb.exe', 'pg_ctl.exe', 'createdb.exe', 'psql.exe')
        if (@($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $fullPath $_) ) }).Count -eq 0) {
            return $fullPath
        }
    }

    throw 'PostgreSQL no fue encontrado. Instala PostgreSQL 16 o superior, o define POSTGRES_BIN con la carpeta bin.'
}

function Get-OrCreateLocalSecrets {
    param(
        [Parameter(Mandatory)] $Config
    )

    if (Test-Path -LiteralPath $Config.SecretsPath) {
        $saved = Get-Content -Raw -LiteralPath $Config.SecretsPath | ConvertFrom-Json
        if ($saved.DatabasePassword.Length -lt 32 -or $saved.JwtSecret.Length -lt 32) {
            throw 'El archivo local de secretos no es válido. Elimina .local/secrets.json y vuelve a preparar el entorno.'
        }
        return $saved
    }

    $null = New-Item -ItemType Directory -Path $Config.LocalDirectory -Force
    $databaseBytes = [byte[]]::new(36)
    $jwtBytes = [byte[]]::new(48)
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $random.GetBytes($databaseBytes)
        $random.GetBytes($jwtBytes)
    } finally {
        $random.Dispose()
    }
    $secrets = [pscustomobject]@{
        DatabasePassword = [Convert]::ToBase64String($databaseBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
        JwtSecret = [Convert]::ToBase64String($jwtBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    }
    [IO.File]::WriteAllText($Config.SecretsPath, ($secrets | ConvertTo-Json))
    return $secrets
}

function Write-LocalEnvironmentFiles {
    param(
        [Parameter(Mandatory)] $Config,
        [Parameter(Mandatory)] [string] $DatabasePassword,
        [Parameter(Mandatory)] [string] $JwtSecret
    )

    $encodedPassword = [Uri]::EscapeDataString($DatabasePassword)
    $databaseUrl = "postgresql://$($Config.DatabaseUser):$encodedPassword@127.0.0.1:$($Config.PostgresPort)/$($Config.DatabaseName)?schema=public"
    $newLine = [Environment]::NewLine

    $backendContent = @(
        ('DATABASE_URL="{0}"' -f $databaseUrl)
        ('JWT_SECRET="{0}"' -f $JwtSecret)
        'JWT_EXPIRES_IN="7d"'
        'GEMINI_API_KEY=""'
        'CLAUDE_API_KEY=""'
        ('CORS_ORIGIN="http://localhost:{0}"' -f $Config.FrontendPort)
        ('FRONTEND_URL="http://localhost:{0}"' -f $Config.FrontendPort)
        'GENERATED_PROJECTS_PATH="./generated-projects"'
        'ARTIFACT_STORAGE_PATH="./artifacts"'
        'REPOSITORY_TEXT_MAX_BYTES=1000000'
        'REPOSITORY_DIFF_MAX_BYTES=1000000'
        "PORT=$($Config.BackendPort)"
        ''
    ) -join $newLine

    $frontendContent = @(
        "NEXT_PUBLIC_API_URL=http://localhost:$($Config.BackendPort)/api"
        "NEXT_PUBLIC_WS_URL=http://localhost:$($Config.BackendPort)"
        ''
    ) -join $newLine

    [IO.File]::WriteAllText($Config.BackendEnvironmentPath, $backendContent)
    [IO.File]::WriteAllText($Config.FrontendEnvironmentPath, $frontendContent)
}
