@echo off
echo Starting complete repository wipe and upload process...

REM Add all current files to staging
echo Adding all files to staging...
git add .

REM Commit the changes
echo Committing changes...
git commit -m "Complete repository reset and update - Victor 3.0"

REM Force push to overwrite everything on GitHub
echo Force pushing to GitHub (this will completely wipe and replace the repository)...
git push origin main --force

echo Repository has been completely wiped and updated!
echo Please check https://github.com/Akhashcs24/Victor-ta to verify the changes.
pause 