# BevDist Cloud Backup Script for Windows
# Goal: Perform a database dump and upload to cloud storage.

Write-Host "💾 Starting Database Backup..." -ForegroundColor Cyan

$dbName = "bevdist_db"
$dbUser = $env:USERNAME
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "C:\BevDistBackups\bevdist_db_$timestamp.sql"

# Ensure backup directory exists
if (!(Test-Path "C:\BevDistBackups")) { New-Item -ItemType Directory -Path "C:\BevDistBackups" | Out-Null }

# 1. Perform pg_dump
Write-Host "🐘 Dumping database to $backupFile..." -ForegroundColor Yellow
$pgBinPath = "C:\Program Files\PostgreSQL\15\bin"
& "$pgBinPath\pg_dump.exe" -U $dbUser $dbName -f $backupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Local backup created successfully." -ForegroundColor Green
    
    # 2. Cloud Upload (Placeholder)
    Write-Host "☁️ Uploading to Cloud..." -ForegroundColor Yellow
    # TODO: Implement specific upload logic (S3, Google Drive, etc.) based on user preference
    Write-Host "⚠️ Cloud upload logic is pending provider selection." -ForegroundColor Magenta
} else {
    Write-Host "❌ Backup failed!" -ForegroundColor Red
}
