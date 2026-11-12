[CmdletBinding()]
param(
    [string]$DatabaseName = 'bevdist_db',
    [string]$DatabaseRole = 'bevdist_app',
    [string]$DatabaseAdmin = 'postgres',
    [int]$DatabasePort = 5432
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot 'mobileBackend'
$frontendIndex = Join-Path $repoRoot 'mobileFrontend\dist\index.html'
$envPath = Join-Path $backendPath '.env'
$pgBin = Join-Path $env:ProgramFiles 'PostgreSQL\15\bin'
$psql = Join-Path $pgBin 'psql.exe'
$createdb = Join-Path $pgBin 'createdb.exe'

function ConvertTo-PlainText([Security.SecureString]$Value) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Invoke-AdminPsql([string]$Sql, [switch]$Quiet) {
    $output = $Sql | & $psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $DatabasePort -U $DatabaseAdmin -d postgres -tA 2>&1
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL setup failed. Check the administrator password and PostgreSQL service. $output" }
    if (-not $Quiet) { Write-Host ($output -join [Environment]::NewLine) }
    return ($output -join '').Trim()
}

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'Node.js and npm are required. Install the current Node.js LTS release, reopen PowerShell, then run this script again.'
}
if (-not (Test-Path $psql) -or -not (Test-Path $createdb)) {
    throw "PostgreSQL 15 command tools were not found at $pgBin. Install PostgreSQL 15, then run this script again."
}
if (-not (Test-Path $frontendIndex)) {
    throw "Web app build not found: $frontendIndex. Build it on your Mac and copy its dist folder to mobileFrontend\dist first. See ops\README.md."
}
if ($DatabaseRole -notmatch '^[A-Za-z_][A-Za-z0-9_]*$' -or $DatabaseName -notmatch '^[A-Za-z_][A-Za-z0-9_]*$' -or $DatabaseAdmin -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    throw 'Database, role, and administrator names may contain only letters, numbers, and underscores, and must not start with a number.'
}

Write-Host 'BevDist setup for Windows 11' -ForegroundColor Cyan
Write-Host "Repository: $repoRoot"
Write-Host 'This configures a single-device install. The API will only listen on this Surface.'

if (-not (Test-Path $envPath)) {
    $pgService = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Where-Object Status -eq 'Running' | Select-Object -First 1
    if (-not $pgService) { throw 'No running PostgreSQL service found. Start the PostgreSQL 15 service in Windows Services, then retry.' }

    $adminSecret = Read-Host "PostgreSQL administrator password for '$DatabaseAdmin'" -AsSecureString
    $adminPlain = ConvertTo-PlainText $adminSecret
    $env:PGPASSWORD = $adminPlain
    try {
        $roleExists = Invoke-AdminPsql "SELECT 1 FROM pg_roles WHERE rolname = '$DatabaseRole';" -Quiet
        if (-not $roleExists) {
            $appSecret = Read-Host "New password for database role '$DatabaseRole'" -AsSecureString
            $appPlain = ConvertTo-PlainText $appSecret
            if ($appPlain.Length -lt 16) { throw 'Use a database password with at least 16 characters.' }
            $sqlPassword = $appPlain.Replace("'", "''")
            $quotedRole = '"' + $DatabaseRole.Replace('"', '""') + '"'
            Invoke-AdminPsql "CREATE ROLE $quotedRole LOGIN PASSWORD '$sqlPassword';" -Quiet | Out-Null
        } else {
            $appSecret = Read-Host "Password for existing database role '$DatabaseRole'" -AsSecureString
            $appPlain = ConvertTo-PlainText $appSecret
            if ($appPlain.Length -lt 16) { throw 'Use a database password with at least 16 characters.' }
        }

        $databaseExists = Invoke-AdminPsql "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';" -Quiet
        if (-not $databaseExists) {
            & $createdb -h 127.0.0.1 -p $DatabasePort -U $DatabaseAdmin -O $DatabaseRole -E UTF8 $DatabaseName
            if ($LASTEXITCODE -ne 0) { throw "Could not create database '$DatabaseName'." }
        } else {
            $databaseOwner = Invoke-AdminPsql "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '$DatabaseName';" -Quiet
            if ($databaseOwner -cne $DatabaseRole) {
                throw "Database '$DatabaseName' already exists and is owned by '$databaseOwner'. No ownership or data was changed. Use pgAdmin to provision a fresh database owned by '$DatabaseRole', or provide a role with appropriate ownership."
            }
            Write-Host "Using existing database '$DatabaseName'; its data was left unchanged." -ForegroundColor Yellow
        }
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        $adminPlain = $null
    }

    $encodedUser = [Uri]::EscapeDataString($DatabaseRole)
    $encodedPassword = [Uri]::EscapeDataString($appPlain)
    $jwtBytes = New-Object byte[] 48
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($jwtBytes) } finally { $generator.Dispose() }
    $jwtSecret = ([BitConverter]::ToString($jwtBytes) -replace '-', '').ToLowerInvariant()
    $configuration = @(
        'PORT=5000',
        'HOST=127.0.0.1',
        'NODE_ENV=production',
        "DATABASE_URL=postgresql://${encodedUser}:${encodedPassword}@127.0.0.1:${DatabasePort}/${DatabaseName}",
        "JWT_SECRET=${jwtSecret}"
    ) -join "`n"
    $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
    [IO.File]::WriteAllText($envPath, $configuration + "`n", $utf8NoBom)
    $appPlain = $null
    Write-Host "Created $envPath with a generated JWT secret. Keep this file private." -ForegroundColor Green
} else {
    Write-Host 'Existing mobileBackend\.env found; it will not be overwritten.' -ForegroundColor Yellow
}

Push-Location $backendPath
try {
    Write-Host 'Installing backend dependencies...' -ForegroundColor Cyan
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    Write-Host 'Checking database connection...' -ForegroundColor Cyan
    & npm.cmd run db:check
    if ($LASTEXITCODE -ne 0) { throw 'Database check failed. Verify mobileBackend\.env and PostgreSQL, then rerun setup.' }
    Write-Host 'Applying database migrations...' -ForegroundColor Cyan
    & npm.cmd run db:migrate
    if ($LASTEXITCODE -ne 0) { throw 'Database migrations failed. Review the error before retrying.' }
} finally { Pop-Location }

Write-Host ''
Write-Host 'Setup complete.' -ForegroundColor Green
Write-Host 'Next: create the POS login, then start the server:'
Write-Host "  Set-Location `"$backendPath`""
Write-Host '  npm run user:create -- junemel'
Write-Host "  & `"$(Join-Path $PSScriptRoot 'manage-server.ps1')`" -Action start"
Write-Host 'Open http://127.0.0.1:5000 on this Surface.'
