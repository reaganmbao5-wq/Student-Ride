# Student-Ride Dev Launcher
# Auto-detects hotspot IP so phone can always reach the backend
param(
    [switch]$NoServers  # Just update .env, don't start servers
)

# --- Step 1: Detect the laptop's hotspot-facing IP ---
$ip = $null
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike '127.*' -and
    $_.IPAddress -notlike '172.*' -and
    $_.IPAddress -notlike '169.254.*' -and
    $_.InterfaceAlias -notlike '*Loopback*' -and
    $_.InterfaceAlias -notlike '*VMware*' -and
    $_.InterfaceAlias -notlike '*WSL*' -and
    $_.InterfaceAlias -notlike '*Bluetooth*'
}
$preferred = $ips | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' }
if ($preferred) {
    $ip = ($preferred | Sort-Object { $_.IPAddress -like '192.*' } -Descending)[0].IPAddress
} elseif ($ips) {
    $ip = $ips[0].IPAddress
} else {
    $ip = "localhost"
}

Write-Host "`n📡 Hotspot IP detected: $ip" -ForegroundColor Cyan

# --- Step 2: Update frontend/.env with the live IP ---
$envFile = Join-Path $PSScriptRoot "frontend\.env"
$newContent = @"
REACT_APP_API_URL=http://${ip}:8000/api
REACT_APP_BACKEND_URL=http://${ip}:8000
"@
$newContent | Out-File -FilePath $envFile -Encoding ASCII -Force
Write-Host "✅ frontend/.env updated to http://${ip}:8000" -ForegroundColor Green

# --- Step 3: Also update phone-servers.txt on Desktop ---
$desktopFile = [Environment]::GetFolderPath("Desktop") + "\phone-servers.txt"
$txt = @"
PHONE DEV SERVERS
Laptop IP: $ip
====================

Student-Ride API   http://${ip}:8000
Student-Ride App   http://${ip}:3000
Dograh AI          http://${ip}:3010
n8n                http://${ip}:5678
OmniParser         http://${ip}:7860

Updated: $(Get-Date)
"@
$txt | Out-File -FilePath $desktopFile -Encoding ASCII -Force
Write-Host "✅ Desktop phone-servers.txt updated" -ForegroundColor Green

# --- Step 4: Update phone-bridge HTML too ---
$bridgeDir = "$env:USERPROFILE\AppData\Local\hermes\phone-bridge"
New-Item -ItemType Directory -Force -Path $bridgeDir | Out-Null
$html = @"
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Dev Servers</title>
<style>body{font-family:Segoe UI,sans-serif;background:#111;color:#eee;padding:20px}
a{color:#4af;text-decoration:none;display:block;padding:8px;margin:4px 0;background:#222;border-radius:6px}
h2{color:#4af}</style></head><body>
<h2>Localhost Bridge Active</h2>
<p>Laptop IP: <b>$ip</b></p>
<p>Open these on your phone:</p>
<a href="http://${ip}:3000">Student-Ride App (3000)</a>
<a href="http://${ip}:8000/docs">Student-Ride API Docs (8000)</a>
<a href="http://${ip}:3010">Dograh AI (3010)</a>
<a href="http://${ip}:5678">n8n (5678)</a>
<a href="http://${ip}:7860">OmniParser (7860)</a>
<p style="margin-top:20px;color:#888;font-size:12px">Updated: $(Get-Date)</p>
</body></html>
"@
$html | Out-File -FilePath "$bridgeDir\index.html" -Encoding UTF8 -Force
$ip | Out-File -FilePath "$bridgeDir\ip.txt" -Encoding ASCII -Force

if ($NoServers) {
    Write-Host "`n✅ Env updated. Run start_servers.bat manually when ready.`n" -ForegroundColor Yellow
    return
}

# --- Step 5: Firewall (port 8000 should already be open, but ensure 3000 too) ---
$portsToOpen = @(3000, 8000)
foreach ($port in $portsToOpen) {
    $name = "Student-Ride Port $port"
    $existing = netsh advfirewall firewall show rule name="$name" 2>&1
    if ($LASTEXITCODE -ne 0 -or $existing -match "No rules match") {
        netsh advfirewall firewall add rule name="$name" dir=in action=allow protocol=TCP localport=$port | Out-Null
        Write-Host "🔓 Firewall rule added for port $port" -ForegroundColor Yellow
    }
}

# --- Step 6: Start backend and frontend ---
$backendDir = Join-Path $PSScriptRoot "backend"
$frontendDir = Join-Path $PSScriptRoot "frontend"

Write-Host "`n🚀 Starting backend (port 8000)..." -ForegroundColor Cyan
$backendJob = Start-Process -WindowStyle Hidden -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$backendDir`" && python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload" -PassThru

Start-Sleep -Seconds 2

Write-Host "🚀 Starting frontend (port 3000)..." -ForegroundColor Cyan
$frontendJob = Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$frontendDir`" && set BROWSER=none && yarn start" -PassThru

Write-Host "`n✅ Both servers starting!" -ForegroundColor Green
Write-Host "   Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "   Backend:  http://${ip}:8000  (from phone)" -ForegroundColor White
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "   Frontend: http://${ip}:3000     (from phone)" -ForegroundColor White
Write-Host "`n📋 phone-servers.txt on your Desktop has all URLs`n" -ForegroundColor Yellow
