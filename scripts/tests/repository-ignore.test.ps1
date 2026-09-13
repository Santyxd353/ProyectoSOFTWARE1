$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$ignoredPath = '.local/secrets.json'
$result = & git -C $repositoryRoot check-ignore $ignoredPath

if ($LASTEXITCODE -ne 0 -or ($result | Out-String).Trim() -ne $ignoredPath) {
    throw '.local runtime data and credentials must be ignored by Git.'
}

Write-Output 'PASS repository local ignore'
