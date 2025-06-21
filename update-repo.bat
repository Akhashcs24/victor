@echo off
echo Starting repository update process...

REM Check if we're in a git repository
if not exist ".git" (
    echo Error: Not in a git repository. Please run 'git init' first.
    pause
    exit /b 1
)

REM Add all files to staging
echo Adding all files to staging...
git add .

REM Commit the changes
echo Committing changes...
set /p commitMessage="Enter commit message (or press Enter for default): "
if "%commitMessage%"=="" set commitMessage="Update Victor 3.0 - Complete rewrite with new features"

git commit -m %commitMessage%

REM Check if remote origin exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo No remote origin found. Adding remote...
    git remote add origin https://github.com/Akhashcs24/Victor-ta.git
)

REM Force push to overwrite everything on GitHub
echo Force pushing to GitHub (this will overwrite everything on the remote repository)...
echo Are you sure you want to continue? This will delete everything on GitHub and replace it with your local files.
set /p confirm="Type 'yes' to continue: "

if /i "%confirm%"=="yes" (
    git push origin main --force
    echo Repository updated successfully!
) else (
    echo Operation cancelled.
)

pause 