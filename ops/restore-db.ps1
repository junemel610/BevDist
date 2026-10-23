# BevDist DB Restore Script for Windows
# Goal: Restore the database from a .sql backup file.

param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFilePath
)

Write-Host "🔄 Starting Database Restore..." -ForegroundColor Cyan

$dbName = "bevdist_db"
$dbUser = $env:USERNAME
$pgBinPath = "C:\Program Files\PostgreSQL\15\bin"

if (!(Test-Path $BackupFilePath)) {
    Write-Host "❌ Backup file not found: $BackupFilePath" -ForegroundColor Red
    exit 1
}

# Restore using psql
Write-Host "🐘 Restoring $BackupFilePath into $dbName..." -ForegroundColor Yellow
& "$pgBinPath\psql.exe" -U $dbUser -d $dbName -f $BackupFilePath

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database restored successfully." -ForegroundColor Green
} else {
    Write-Host "❌ Restore failed!" -ForegroundColor Red
}
