# BevDist Server Management Script for Windows
# Goal: Start, stop, and monitor the backend using PM2.

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action
)

$backendPath = "Project/mobileBackend"

# Install PM2 globally if missing
if (!(Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing PM2..." -ForegroundColor Yellow
    npm install -g pm2
}

switch ($Action) {
    "start" {
        Write-Host "🚀 Starting server..." -ForegroundColor Cyan
        cd $backendPath
        pm2 start server.js --name "bevdist-api"
    }
    "stop" {
        Write-Host "🛑 Stopping server..." -ForegroundColor Cyan
        pm2 stop bevdist-api
    }
    "restart" {
        Write-Host "🔄 Restarting server..." -ForegroundColor Cyan
        pm2 restart bevdist-api
    }
    "status" {
        pm2 status
    }
}
