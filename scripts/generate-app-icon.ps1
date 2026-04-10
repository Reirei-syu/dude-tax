$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetDir = Join-Path $projectRoot "apps\desktop\assets"
$iconSizesDir = Join-Path $assetDir "icon-sizes"

New-Item -ItemType Directory -Force -Path $assetDir | Out-Null
New-Item -ItemType Directory -Force -Path $iconSizesDir | Out-Null

function New-RoundedRectanglePath {
  param(
    [float]$x,
    [float]$y,
    [float]$width,
    [float]$height,
    [float]$radius
  )

  $diameter = $radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Get-AppFontFamilyName {
  $preferred = @("Microsoft YaHei UI", "Segoe UI Symbol", "Segoe UI", "Arial")
  $available = [System.Drawing.FontFamily]::Families | ForEach-Object { $_.Name }
  foreach ($name in $preferred) {
    if ($available -contains $name) {
      return $name
    }
  }

  return [System.Drawing.FontFamily]::GenericSansSerif.Name
}

function Draw-Star {
  param(
    [System.Drawing.Graphics]$graphics,
    [int]$size,
    [double]$centerX,
    [double]$centerY,
    [double]$outerRadiusRatio,
    [double]$innerRadiusRatio,
    [System.Drawing.Color]$color
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  try {
    $points = @()
    for ($index = 0; $index -lt 8; $index++) {
      $angle = (-90 + ($index * 45)) * [Math]::PI / 180
      $radius = if ($index % 2 -eq 0) { $size * $outerRadiusRatio } else { $size * $innerRadiusRatio }
      $x = ($size * $centerX) + ([Math]::Cos($angle) * $radius)
      $y = ($size * $centerY) + ([Math]::Sin($angle) * $radius)
      $points += [System.Drawing.PointF]::new([float]$x, [float]$y)
    }
    $path.AddPolygon($points)

    $brush = New-Object System.Drawing.SolidBrush -ArgumentList $color
    try {
      $graphics.FillPath($brush, $path)
    } finally {
      $brush.Dispose()
    }
  } finally {
    $path.Dispose()
  }
}

function New-IconBitmap {
  param(
    [int]$size
  )

  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $shadowColor = [System.Drawing.Color]::FromArgb(36, 146, 185, 223)
    $bgFrom = [System.Drawing.Color]::FromArgb(255, 249, 252, 255)
    $bgTo = [System.Drawing.Color]::FromArgb(255, 234, 245, 255)
    $borderColor = [System.Drawing.Color]::FromArgb(255, 220, 238, 255)
    $white140 = [System.Drawing.Color]::FromArgb(140, 255, 255, 255)
    $white104 = [System.Drawing.Color]::FromArgb(104, 255, 255, 255)
    $white96 = [System.Drawing.Color]::FromArgb(96, 255, 255, 255)
    $cardFrom = [System.Drawing.Color]::FromArgb(255, 233, 247, 255)
    $cardTo = [System.Drawing.Color]::FromArgb(255, 217, 238, 255)
    $cardBorder = [System.Drawing.Color]::FromArgb(255, 200, 229, 251)
    $lineStrong = [System.Drawing.Color]::FromArgb(255, 184, 223, 255)
    $lineSoft = [System.Drawing.Color]::FromArgb(255, 199, 231, 255)
    $coinShadow = [System.Drawing.Color]::FromArgb(46, 167, 200, 234)
    $coinFrom = [System.Drawing.Color]::FromArgb(255, 255, 247, 216)
    $coinTo = [System.Drawing.Color]::FromArgb(255, 255, 213, 140)
    $coinBorder = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
    $highlightColor = [System.Drawing.Color]::FromArgb(132, 255, 255, 255)
    $symbolColor = [System.Drawing.Color]::FromArgb(255, 77, 130, 194)
    $cheekColor = [System.Drawing.Color]::FromArgb(196, 255, 202, 209)
    $smileColor = [System.Drawing.Color]::FromArgb(255, 196, 129, 99)
    $starWarm = [System.Drawing.Color]::FromArgb(255, 255, 242, 181)
    $starCool = [System.Drawing.Color]::FromArgb(255, 221, 238, 255)

    $shadowPath = New-RoundedRectanglePath -x ($size * 0.12) -y ($size * 0.14) -width ($size * 0.76) -height ($size * 0.76) -radius ($size * 0.18)
    $shadowBrush = New-Object System.Drawing.SolidBrush -ArgumentList $shadowColor
    $graphics.FillPath($shadowBrush, $shadowPath)
    $shadowBrush.Dispose()
    $shadowPath.Dispose()

    $baseRect = [System.Drawing.RectangleF]::new([float]($size * 0.12), [float]($size * 0.12), [float]($size * 0.76), [float]($size * 0.76))
    $basePath = New-RoundedRectanglePath -x $baseRect.X -y $baseRect.Y -width $baseRect.Width -height $baseRect.Height -radius ($size * 0.18)
    $baseBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
      [System.Drawing.PointF]::new($baseRect.Left, $baseRect.Top)
    ), (
      [System.Drawing.PointF]::new($baseRect.Right, $baseRect.Bottom)
    ), $bgFrom, $bgTo
    $basePen = New-Object System.Drawing.Pen -ArgumentList $borderColor, ($size * 0.008)
    $graphics.FillPath($baseBrush, $basePath)
    $graphics.DrawPath($basePen, $basePath)
    $baseBrush.Dispose()
    $basePen.Dispose()
    $basePath.Dispose()

    $bubbleSpecs = @(
      @{ X = 0.26; Y = 0.27; Radius = 0.062; Color = $white140 },
      @{ X = 0.70; Y = 0.24; Radius = 0.034; Color = $white96 },
      @{ X = 0.75; Y = 0.70; Radius = 0.052; Color = $white104 }
    )
    foreach ($bubble in $bubbleSpecs) {
      $brush = New-Object System.Drawing.SolidBrush -ArgumentList $bubble.Color
      $diameter = $size * $bubble.Radius * 2
      $graphics.FillEllipse($brush, ($size * $bubble.X) - ($diameter / 2), ($size * $bubble.Y) - ($diameter / 2), $diameter, $diameter)
      $brush.Dispose()
    }

    $graphics.TranslateTransform([float]($size * 0.40), [float]($size * 0.46))
    $graphics.RotateTransform(-12)
    $cardRect = [System.Drawing.RectangleF]::new([float](-$size * 0.12), [float](-$size * 0.16), [float]($size * 0.24), [float]($size * 0.33))
    $cardPath = New-RoundedRectanglePath -x $cardRect.X -y $cardRect.Y -width $cardRect.Width -height $cardRect.Height -radius ($size * 0.05)
    $cardBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
      [System.Drawing.PointF]::new($cardRect.Left, $cardRect.Top)
    ), (
      [System.Drawing.PointF]::new($cardRect.Right, $cardRect.Bottom)
    ), $cardFrom, $cardTo
    $cardPen = New-Object System.Drawing.Pen -ArgumentList $cardBorder, ($size * 0.006)
    $graphics.FillPath($cardBrush, $cardPath)
    $graphics.DrawPath($cardPen, $cardPath)
    $cardBrush.Dispose()
    $cardPen.Dispose()
    $cardPath.Dispose()

    $lineBrush = New-Object System.Drawing.SolidBrush -ArgumentList $lineStrong
    $graphics.FillRectangle($lineBrush, [float](-$size * 0.06), [float](-$size * 0.08), [float]($size * 0.12), [float]($size * 0.014))
    $lineBrush.Dispose()
    $lineBrush = New-Object System.Drawing.SolidBrush -ArgumentList $lineSoft
    $graphics.FillRectangle($lineBrush, [float](-$size * 0.06), [float](-$size * 0.03), [float]($size * 0.10), [float]($size * 0.010))
    $graphics.FillRectangle($lineBrush, [float](-$size * 0.06), [float]($size * 0.01), [float]($size * 0.08), [float]($size * 0.010))
    $lineBrush.Dispose()
    $graphics.ResetTransform()

    $shadowBrush = New-Object System.Drawing.SolidBrush -ArgumentList $coinShadow
    $graphics.FillEllipse($shadowBrush, [float]($size * 0.33), [float]($size * 0.69), [float]($size * 0.34), [float]($size * 0.08))
    $shadowBrush.Dispose()

    $coinRect = [System.Drawing.RectangleF]::new([float]($size * 0.31), [float]($size * 0.28), [float]($size * 0.38), [float]($size * 0.38))
    $coinBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
      [System.Drawing.PointF]::new($coinRect.Left, $coinRect.Top)
    ), (
      [System.Drawing.PointF]::new($coinRect.Right, $coinRect.Bottom)
    ), $coinFrom, $coinTo
    $coinPen = New-Object System.Drawing.Pen -ArgumentList $coinBorder, ($size * 0.014)
    $graphics.FillEllipse($coinBrush, $coinRect)
    $graphics.DrawEllipse($coinPen, $coinRect)
    $coinBrush.Dispose()
    $coinPen.Dispose()

    $highlightPen = New-Object System.Drawing.Pen -ArgumentList $highlightColor, ($size * 0.018)
    $graphics.DrawArc($highlightPen, [float]($size * 0.37), [float]($size * 0.32), [float]($size * 0.20), [float]($size * 0.12), 200, 110)
    $highlightPen.Dispose()

    $fontFamilyName = Get-AppFontFamilyName
    $fontStyle = [System.Drawing.FontStyle]::Bold
    $fontUnit = [System.Drawing.GraphicsUnit]::Pixel
    $font = New-Object System.Drawing.Font -ArgumentList $fontFamilyName, ([Math]::Round($size * 0.24)), $fontStyle, $fontUnit
    $stringFormat = New-Object System.Drawing.StringFormat
    $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
    $symbolBrush = New-Object System.Drawing.SolidBrush -ArgumentList $symbolColor
    $symbolRect = [System.Drawing.RectangleF]::new([float]($size * 0.36), [float]($size * 0.33), [float]($size * 0.34), [float]($size * 0.22))
    $graphics.DrawString([char]0xFFE5, $font, $symbolBrush, $symbolRect, $stringFormat)
    $symbolBrush.Dispose()
    $font.Dispose()
    $stringFormat.Dispose()

    $cheeks = @(
      @{ X = 0.45; Y = 0.60 },
      @{ X = 0.61; Y = 0.60 }
    )
    foreach ($cheek in $cheeks) {
      $brush = New-Object System.Drawing.SolidBrush -ArgumentList $cheekColor
      $graphics.FillEllipse($brush, [float]($size * ($cheek.X - 0.024)), [float]($size * ($cheek.Y - 0.014)), [float]($size * 0.048), [float]($size * 0.032))
      $brush.Dispose()
    }

    $smilePen = New-Object System.Drawing.Pen -ArgumentList $smileColor, ([float]($size * 0.010))
    $graphics.DrawArc($smilePen, [float]($size * 0.47), [float]($size * 0.60), [float]($size * 0.10), [float]($size * 0.05), 20, 140)
    $smilePen.Dispose()

    Draw-Star -graphics $graphics -size $size -centerX 0.70 -centerY 0.35 -outerRadiusRatio 0.034 -innerRadiusRatio 0.014 -color $starWarm
    Draw-Star -graphics $graphics -size $size -centerX 0.31 -centerY 0.67 -outerRadiusRatio 0.022 -innerRadiusRatio 0.009 -color $starCool

    return $bitmap
  } finally {
    $graphics.Dispose()
  }
}

$icoSizes = @(16, 24, 32, 48, 64, 128, 256)

foreach ($size in $icoSizes + 512) {
  $bitmap = New-IconBitmap -size $size
  try {
    $pngPath = if ($size -eq 512) {
      Join-Path $assetDir "app-icon.png"
    } else {
      Join-Path $iconSizesDir ("app-icon-{0}.png" -f $size)
    }

    $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $bitmap.Dispose()
  }
}

& node (Join-Path $projectRoot "scripts\build-ico-from-pngs.mjs") --asset-dir $assetDir | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "ICO generation failed."
}

Write-Output "Generated icon assets:"
Write-Output (Join-Path $assetDir "app-icon.png")
Write-Output (Join-Path $assetDir "app-icon.ico")
