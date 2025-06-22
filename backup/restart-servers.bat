@echo off
echo === Victor 3.0 Server Management Script ===
echo.

echo Stopping any running Node.js processes...
taskkill /f /im node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo All Node.js processes terminated
) else (
    echo No active Node.js processes found
)

echo.
echo Waiting for ports to be released...
timeout /t 1 >nul

echo.
echo Starting backend server...
start "Victor 3.0 Backend Server" cmd /k "cd server && node index.js"

echo Waiting for server to initialize...
timeout /t 2 >nul

echo.
echo Starting frontend client...
start "Victor 3.0 Frontend Client" cmd /k "cd client && npm run dev"

echo.
echo All services started!
echo   * Backend: http://localhost:5000
echo   * Frontend: http://localhost:3000
echo.
echo Press Ctrl+C in the respective windows to stop the services.
echo. 