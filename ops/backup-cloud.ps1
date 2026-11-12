[CmdletBinding()]
param(
    [string]$CloudDestination,
    [string]$BackupDirectory = (Join-Path $env:LOCALAPPDATA 'BevDist\backups')
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
$config = Get-BevDistDatabaseConfig
$pgDump = Get-BevDistPgTool 'pg_dump'
New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = Join-Path $BackupDirectory "bevdist_$timestamp.dump"

Set-BevDistPgPassword $config
try {
    Write-Host "Creating database backup: $backupFile" -ForegroundColor Cyan
    & $pgDump --format=custom --no-owner --host $config.Host --port $config.Port --username $config.Username --dbname $config.Database --file $backupFile
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed. No completed backup was produced.' }
} finally { Clear-BevDistPgPassword }

if (-not (Test-Path $backupFile) -or (Get-Item $backupFile).Length -eq 0) {
    Remove-Item $backupFile -ErrorAction SilentlyContinue
    throw 'The backup file is missing or empty.'
}
Write-Host "Local backup created ($('{0:N1}' -f ((Get-Item $backupFile).Length / 1MB)) MB)." -ForegroundColor Green

if ($CloudDestination) {
    $rclone = Get-Command rclone.exe -ErrorAction SilentlyContinue
    if (-not $rclone) { throw 'Cloud destination was supplied but rclone is not installed/configured. The local backup is safe at the path above.' }
    & $rclone.Source copy $backupFile $CloudDestination --create-empty-src-dirs
    if ($LASTEXITCODE -ne 0) { throw "Cloud copy failed. The local backup remains at $backupFile." }
    Write-Host "Backup copied to configured cloud destination: $CloudDestination" -ForegroundColor Green
} else {
    Write-Host 'Cloud upload skipped. Configure rclone and pass -CloudDestination to send a copy.' -ForegroundColor Yellow
}

Write-Host "Backup file: $backupFile"
