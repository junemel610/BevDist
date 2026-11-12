[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'install-startup', 'remove-startup')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot 'mobileBackend'
$statePath = Join-Path $env:LOCALAPPDATA 'BevDist'
$logPath = Join-Path $statePath 'logs'
$pidPath = Join-Path $statePath 'api.pid'
$taskName = 'BevDist POS API'
$healthUrl = 'http://127.0.0.1:5000/health'
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Force -Path $statePath, $logPath | Out-Null

function Test-ApiHealth {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
        return $response.status -eq 'ok' -and $response.database -eq 'connected'
    } catch { return $false }
}

function Get-ManagedProcess {
    if (-not (Test-Path $pidPath)) { return $null }
    $storedPid = 0
    if (-not [int]::TryParse((Get-Content $pidPath -Raw).Trim(), [ref]$storedPid)) { return $null }
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $storedPid" -ErrorAction SilentlyContinue
    $serverPath = Join-Path $backendPath 'server.js'
    if (-not $processInfo -or $processInfo.CommandLine -notlike "*$serverPath*") { return $null }
    return Get-Process -Id $storedPid -ErrorAction SilentlyContinue
}

switch ($Action) {
    'start' {
        if (Test-ApiHealth) { Write-Host 'BevDist is already running and the database is healthy.' -ForegroundColor Green; break }
        if (-not $nodeCommand) { throw 'node.exe was not found. Install Node.js LTS and reopen PowerShell.' }
        if (-not (Test-Path (Join-Path $backendPath '.env'))) { throw 'mobileBackend\.env is missing. Run ops\setup-server.ps1 first.' }
        $stdout = Join-Path $logPath 'api.log'
        $stderr = Join-Path $logPath 'api-error.log'
        $serverPath = Join-Path $backendPath 'server.js'
        $process = Start-Process -FilePath $nodeCommand.Source -ArgumentList "`"$serverPath`"" -WorkingDirectory $backendPath -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
        Set-Content -Path $pidPath -Value $process.Id -NoNewline
        Start-Sleep -Seconds 2
        if (Test-ApiHealth) {
            Write-Host "BevDist is running at http://127.0.0.1:5000 (PID $($process.Id))." -ForegroundColor Green
        } else {
            $stillRunning = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
            if (-not $stillRunning) { Remove-Item $pidPath -ErrorAction SilentlyContinue }
            Write-Host "The server did not report healthy yet. Check $stderr and $stdout." -ForegroundColor Yellow
        }
    }
    'stop' {
        $process = Get-ManagedProcess
        if ($process) { Stop-Process -Id $process.Id -Force; Write-Host 'BevDist server stopped.' -ForegroundColor Yellow }
        else { Write-Host 'BevDist is not running under this manager.' }
        Remove-Item $pidPath -ErrorAction SilentlyContinue
    }
    'restart' {
        & $PSCommandPath -Action stop
        & $PSCommandPath -Action start
    }
    'status' {
        $process = Get-ManagedProcess
        if (Test-ApiHealth) { Write-Host 'API and database: healthy at http://127.0.0.1:5000/health' -ForegroundColor Green }
        elseif ($process) { Write-Host "Node process $($process.Id) is running, but the API/database is not healthy. Check $logPath." -ForegroundColor Yellow }
        else { Write-Host 'BevDist is stopped.' -ForegroundColor Yellow }
    }
    'install-startup' {
        if (-not (Test-Path (Join-Path $backendPath '.env'))) { throw 'mobileBackend\.env is missing. Run ops\setup-server.ps1 first.' }
        $powershell = Join-Path $PSHOME 'powershell.exe'
        $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Action start"
        $userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        $scheduledAction = New-ScheduledTaskAction -Execute $powershell -Argument $arguments
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
        $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
        Register-ScheduledTask -TaskName $taskName -Action $scheduledAction -Trigger $trigger -Principal $principal -Description 'Start the local BevDist POS API when the Surface user signs in.' -Force | Out-Null
        Write-Host "Startup task '$taskName' installed for $userId. It starts when this Windows account signs in." -ForegroundColor Green
    }
    'remove-startup' {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Host "Startup task '$taskName' removed."
    }
}
