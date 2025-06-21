@echo off
echo Starting upload process to new repository...

REM Check if the repository exists in the remote
git ls-remote https://github.com/Akhashcs24/victor.git > nul 2>&1
if %errorlevel% neq 0 (
    echo Error: The repository https://github.com/Akhashcs24/victor.git doesn't exist or is not accessible.
    echo Please create the repository first on GitHub.
    pause
    exit /b 1
)

REM Add the new remote
echo Adding new remote repository...
git remote add victor https://github.com/Akhashcs24/victor.git

REM Add all files to staging
echo Adding all files to staging...
git add .

REM Commit the changes
echo Committing changes...
git commit -m "Initial upload to new repository - Victor 3.0"

REM Push to the new repository
echo Pushing to new repository...
git push -u victor main --force

echo Files have been uploaded to https://github.com/Akhashcs24/victor
echo Please check the repository to verify the changes.
pause 