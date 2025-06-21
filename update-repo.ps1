# PowerShell script to update GitHub repository
# Run this script to clean and push your current files to GitHub

Write-Host "Starting repository update process..." -ForegroundColor Green

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "Error: Not in a git repository. Please run 'git init' first." -ForegroundColor Red
    exit 1
}

# Add all files to staging
Write-Host "Adding all files to staging..." -ForegroundColor Yellow
git add .

# Commit the changes
Write-Host "Committing changes..." -ForegroundColor Yellow
$commitMessage = Read-Host "Enter commit message (or press Enter for default)"
if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = "Update Victor 3.0 - Complete rewrite with new features"
}

git commit -m $commitMessage

# Check if remote origin exists
$remoteExists = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "No remote origin found. Adding remote..." -ForegroundColor Yellow
    git remote add origin https://github.com/Akhashcs24/Victor-ta.git
}

# Force push to overwrite everything on GitHub
Write-Host "Force pushing to GitHub (this will overwrite everything on the remote repository)..." -ForegroundColor Red
Write-Host "Are you sure you want to continue? This will delete everything on GitHub and replace it with your local files." -ForegroundColor Red
$confirm = Read-Host "Type 'yes' to continue"

if ($confirm -eq "yes") {
    git push origin main --force
    Write-Host "Repository updated successfully!" -ForegroundColor Green
} else {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
} 