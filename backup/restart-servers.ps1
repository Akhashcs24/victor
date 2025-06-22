# restart-servers.ps1
# PowerShell script to restart Victor 3.0 servers

Write-Host "=== Victor 3.0 Server Management Script ===" -ForegroundColor Cyan

# Kill any existing Node.js processes
Write-Host "Stopping any running Node.js processes..." -ForegroundColor Yellow
try {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Write-Host "✓ All Node.js processes terminated" -ForegroundColor Green
} 
catch {
    Write-Host "No active Node.js processes found" -ForegroundColor Gray
}

# Wait a moment to ensure ports are released
Start-Sleep -Seconds 1

# Define working directories
$rootDir = $PSScriptRoot
$serverDir = Join-Path -Path $rootDir -ChildPath "server"
$clientDir = Join-Path -Path $rootDir -ChildPath "client"

# Start the server
Write-Host "`nStarting backend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$serverDir'; Write-Host 'Starting server in $serverDir' -ForegroundColor Cyan; node index.js"

# Wait for server to initialize
Write-Host "Waiting for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Start the client
Write-Host "`nStarting frontend client..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$clientDir'; Write-Host 'Starting client in $clientDir' -ForegroundColor Cyan; npm run dev"

Write-Host "`n✓ All services started!" -ForegroundColor Green
Write-Host "  • Backend: http://localhost:5000" -ForegroundColor Cyan
Write-Host "  • Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C in the respective windows to stop the services." -ForegroundColor Gray 