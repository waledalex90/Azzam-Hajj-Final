# ينشئ الريبو Azzam-Hajj-Final على حساب GitHub ويرفع الفرع main.
# المتطلب: تسجيل الدخول مرة واحدة:  gh auth login
# تشغيل من جذر المشروع:  .\scripts\push-github-final.ps1

$ErrorActionPreference = "Stop"
$Repo = "waledalex90/Azzam-Hajj-Final"
$Gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $Gh)) { $Gh = "gh" }

& $Gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "شغّل أولاً: gh auth login  (بحساب waledalex90)" -ForegroundColor Yellow
  exit 1
}

Set-Location (Split-Path -Parent $PSScriptRoot)

& $Gh repo create $Repo --public --source=. --remote=final --description "Azzam Hajj — production app (attendance, workers Excel chunks)" --push
if ($LASTEXITCODE -ne 0) {
  Write-Host "فشل الإنشاء. إذا كان الريبو موجوداً مسبقاً، جرّب:" -ForegroundColor Yellow
  Write-Host "  git remote add final https://github.com/$Repo.git" -ForegroundColor Cyan
  Write-Host "  git push -u final main" -ForegroundColor Cyan
  exit $LASTEXITCODE
}

Write-Host "تم: https://github.com/$Repo" -ForegroundColor Green
