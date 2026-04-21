# One-off: build public/icons/apple-touch-icon.png (180x180) for iOS home screen
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$size = 180
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$bg = [System.Drawing.Color]::FromArgb(255, 11, 11, 12)
$g.Clear($bg)

$gold = [System.Drawing.Color]::FromArgb(255, 212, 175, 55)
$pen = New-Object System.Drawing.Pen $gold, 3
$rInner = 34
$pad = 10
# Rounded rect border (manual arcs)
$x = $pad
$y = $pad
$w = $size - 2 * $pad
$h = $size - 2 * $pad
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($x, $y, $rInner, $rInner, 180, 90)
$path.AddArc($x + $w - $rInner, $y, $rInner, $rInner, 270, 90)
$path.AddArc($x + $w - $rInner, $y + $h - $rInner, $rInner, $rInner, 0, 90)
$path.AddArc($x, $y + $h - $rInner, $rInner, $rInner, 90, 90)
$path.CloseFigure()
$g.DrawPath($pen, $path)

$font = New-Object System.Drawing.Font(
  "Segoe UI", 40.0, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel
)
$brushW = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 248, 250, 252))
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("ABN", $font, $brushW, [System.Drawing.RectangleF]::new(0, 46, $size, 72), $sf)

$font2 = New-Object System.Drawing.Font(
  "Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel
)
$brushG = New-Object System.Drawing.SolidBrush $gold
$g.DrawString("AZZAM", $font2, $brushG, [System.Drawing.RectangleF]::new(0, 114, $size, 28), $sf)

$outDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\public\icons"))
$out = Join-Path $outDir "apple-touch-icon.png"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$rootCopy = Join-Path (Split-Path $outDir -Parent) "apple-touch-icon.png"
Copy-Item -Path $out -Destination $rootCopy -Force

$g.Dispose()
$bmp.Dispose()
$pen.Dispose()
$path.Dispose()
$font.Dispose()
$font2.Dispose()
$brushW.Dispose()
$brushG.Dispose()

Write-Host "Wrote $out"
Write-Host "Wrote $rootCopy"
