[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFilePath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
if (-not (Test-Path $BackupFilePath -PathType Leaf)) { throw "Backup file not found: $BackupFilePath" }
$config = Get-BevDistDatabaseConfig
$pgRestore = Get-BevDistPgTool 'pg_restore'
$resolvedBackup = (Resolve-Path $BackupFilePath).Path
$confirmation = Read-Host "This will replace matching data in database '$($config.Database)'. Type the database name to continue"
if ($confirmation -cne $config.Database) { throw 'Restore cancelled; the confirmation did not match.' }

Set-BevDistPgPassword $config
try {
    Write-Host "Restoring $resolvedBackup into '$($config.Database)'..." -ForegroundColor Yellow
    & $pgRestore --clean --if-exists --no-owner --no-privileges --exit-on-error --single-transaction --host $config.Host --port $config.Port --username $config.Username --dbname $config.Database $resolvedBackup
    if ($LASTEXITCODE -ne 0) { throw 'Restore failed. Review the PostgreSQL error above.' }
} finally { Clear-BevDistPgPassword }

Write-Host 'Restore completed. Start or restart the BevDist API and verify its health endpoint.' -ForegroundColor Green
