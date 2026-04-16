# Creates Azzam-Hajj-Final on GitHub and pushes main. Requires: gh auth login
# Run from repo root: .\scripts\push-github-final.ps1

$ErrorActionPreference = "Stop"
$Repo = "waledalex90/Azzam-Hajj-Final"
$Gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $Gh)) { $Gh = "gh" }

& $Gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run first: gh auth login (as waledalex90)" -ForegroundColor Yellow
  exit 1
}

Set-Location (Split-Path -Parent $PSScriptRoot)

& $Gh repo create $Repo --public --source=. --remote=final --description 'Azzam Hajj production - attendance and workers Excel' --push
if ($LASTEXITCODE -ne 0) {
  Write-Host "Create failed. If repo exists, run:" -ForegroundColor Yellow
  Write-Host "  git remote add final https://github.com/$Repo.git" -ForegroundColor Cyan
  Write-Host "  git push -u final main" -ForegroundColor Cyan
  exit $LASTEXITCODE
}

Write-Host "Done: https://github.com/$Repo" -ForegroundColor Green
