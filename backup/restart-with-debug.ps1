Write-Host "=== Victor 3.0 Server Management Script (Debug Mode) ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping any running Node.js processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
if ($?) {
    Write-Host "All Node.js processes terminated" -ForegroundColor Green
} else {
    Write-Host "No active Node.js processes found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Waiting for ports to be released..." -ForegroundColor Yellow
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "Starting backend server in debug mode..." -ForegroundColor Yellow
$env:DEBUG = "*"
Start-Process cmd -ArgumentList "/k cd server && node --trace-warnings index.js" -WindowStyle Normal

Write-Host "Waiting for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Starting frontend client..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k cd client && npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "All services started in debug mode!" -ForegroundColor Green
Write-Host "  * Backend: http://localhost:5000" -ForegroundColor Cyan
Write-Host "  * Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C in the respective windows to stop the services." -ForegroundColor Yellow
Write-Host ""
Write-Host "Check the backend server window for detailed debug logs." -ForegroundColor Yellow
Write-Host "" 