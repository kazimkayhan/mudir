param(
  [string]$LogoPath = "$PSScriptRoot/../public/brand/logo.png",
  [string]$IconsDir = "$PSScriptRoot/../src-tauri/icons",
  [switch]$CleanupMobileOnly
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Remove-MobileIconOutputs {
  Remove-Item "$IconsDir/android", "$IconsDir/ios" -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item "$IconsDir/icon.icns" -Force -ErrorAction SilentlyContinue
}

if ($CleanupMobileOnly) {
  Remove-MobileIconOutputs
  Write-Host "Removed Android, iOS, and macOS icon outputs."
  exit 0
}

function Save-SquareIconSource {
  param([string]$SourcePath, [string]$DestPath, [double]$PaddingRatio = 0.12)

  $src = [System.Drawing.Image]::FromFile($SourcePath)
  $size = [Math]::Max($src.Width, $src.Height)
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

  $pad = [int]($size * $PaddingRatio)
  $maxW = $size - (2 * $pad)
  $maxH = $size - (2 * $pad)
  $ratio = [Math]::Min($maxW / $src.Width, $maxH / $src.Height)
  $drawW = [int]($src.Width * $ratio)
  $drawH = [int]($src.Height * $ratio)
  $x = [int](($size - $drawW) / 2)
  $y = [int](($size - $drawH) / 2)
  $graphics.DrawImage($src, $x, $y, $drawW, $drawH)

  $graphics.Dispose()
  $src.Dispose()
  $bmp.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Save-InstallerBitmap {
  param(
    [string]$SourcePath,
    [int]$Width,
    [int]$Height,
    [string]$DestPath,
    [ValidateSet("center", "start")]
    [string]$Align = "center"
  )

  $src = [System.Drawing.Image]::FromFile($SourcePath)
  $bmp = New-Object System.Drawing.Bitmap $Width, $Height
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

  $pad = 8
  $maxW = $Width - (2 * $pad)
  $maxH = $Height - (2 * $pad)
  $ratio = [Math]::Min($maxW / $src.Width, $maxH / $src.Height)
  $drawW = [int]($src.Width * $ratio)
  $drawH = [int]($src.Height * $ratio)
  $x = if ($Align -eq "start") { $pad } else { [int](($Width - $drawW) / 2) }
  $y = [int](($Height - $drawH) / 2)
  $graphics.DrawImage($src, $x, $y, $drawW, $drawH)

  $graphics.Dispose()
  $src.Dispose()
  $bmp.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $bmp.Dispose()
}

$iconSource = Join-Path (Split-Path (Resolve-Path $LogoPath).Path -Parent) "logo-icon.png"
Save-SquareIconSource -SourcePath $LogoPath -DestPath $iconSource
Save-InstallerBitmap -SourcePath $LogoPath -Width 164 -Height 314 -DestPath "$IconsDir/installer-sidebar.bmp" -Align center
Save-InstallerBitmap -SourcePath $LogoPath -Width 150 -Height 57 -DestPath "$IconsDir/installer-header.bmp" -Align start

Write-Host "Square icon source: $iconSource"
Write-Host "Installer BMP assets written to $IconsDir"
