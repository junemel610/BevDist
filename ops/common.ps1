$ErrorActionPreference = 'Stop'

function Get-BevDistDatabaseConfig {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $envFile = Join-Path $repoRoot 'mobileBackend\.env'
    if (-not (Test-Path $envFile)) { throw "Backend config not found: $envFile. Run ops\setup-server.ps1 first." }
    $line = Get-Content $envFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if (-not $line) { throw 'DATABASE_URL is missing in mobileBackend\.env.' }
    $value = ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    try { $uri = [Uri]$value } catch { throw 'DATABASE_URL is not a valid PostgreSQL URL.' }
    if ($uri.Scheme -notin @('postgres', 'postgresql')) { throw 'DATABASE_URL must use postgres:// or postgresql://.' }
    $auth = $uri.UserInfo -split ':', 2
    if (-not $auth[0]) { throw 'DATABASE_URL must include its PostgreSQL username.' }
    $database = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
    if (-not $database) { throw 'DATABASE_URL must include the database name.' }
    $password = if ($auth.Count -gt 1) { [Uri]::UnescapeDataString($auth[1]) } else { '' }
    return [pscustomobject]@{
        Host = $uri.Host
        Port = if ($uri.IsDefaultPort) { 5432 } else { $uri.Port }
        Username = [Uri]::UnescapeDataString($auth[0])
        Password = $password
        Database = $database
    }
}

function Get-BevDistPgTool([string]$Name) {
    $candidate = Join-Path $env:ProgramFiles "PostgreSQL\15\bin\$Name.exe"
    if (Test-Path $candidate) { return $candidate }
    $command = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    throw "$Name.exe was not found. Install PostgreSQL 15 command line tools."
}

function Set-BevDistPgPassword($Config) {
    if ($Config.Password) { $env:PGPASSWORD = $Config.Password }
}

function Clear-BevDistPgPassword {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
