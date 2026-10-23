# BevDist Server Setup Script for Windows 8
# Goal: Install Node.js, PostgreSQL 15, and configure the BevDist Backend.

Write-Host "🚀 Starting BevDist Server Installation for Windows..." -ForegroundColor Cyan

# 1. Install Chocolatey (Package Manager)
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing Chocolatey..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
} else {
    Write-Host "✅ Chocolatey already installed." -ForegroundColor Green
}

# 2. Install Node.js (LTS)
Write-Host "🟢 Installing Node.js..." -ForegroundColor Yellow
choco install nodejs-lts -y

# 3. Install PostgreSQL 15
Write-Host "🐘 Installing PostgreSQL 15..." -ForegroundColor Yellow
choco install postgresql15 -y

# 4. Database Setup
Write-Host "🗄️ Configuring Database..." -ForegroundColor Yellow
$dbUser = $env:USERNAME
# Use the pg_wrapper or direct bin path for Windows
$pgBinPath = "C:\Program Files\PostgreSQL\15\bin"
& "$pgBinPath\createdb.exe" -U $dbUser bevdist_db 2>$null
if ($LASTEXITCODE -eq 0) { Write-Host "✅ Database bevdist_db created." -ForegroundColor Green } 
else { Write-Host "⚠️ Database bevdist_db already exists or requires manual password." -ForegroundColor Gray }

# 5. Project Setup
Write-Host "📂 Configuring Backend..." -ForegroundColor Yellow
cd "Project/mobileBackend"
npm install

# 6. Environment Configuration
if (!(Test-Path .env)) {
    Write-Host "📝 Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    # Simple replacement for Windows username in DB URL
    (Get-Content .env) -replace 'YOUR_MAC_USERNAME', $dbUser | Set-Content .env
    Write-Host "⚠️ Please open .env and set a strong JWT_SECRET!" -ForegroundColor Magenta
}

# 7. Database Migrations
Write-Host "🔄 Running Database Migrations..." -ForegroundColor Yellow
npm run db:migrate

Write-Host "`n--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "To start the server: cd Project/mobileBackend; npm run dev"
Write-Host "To create your first admin user: npm run user:create -- admin"
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
