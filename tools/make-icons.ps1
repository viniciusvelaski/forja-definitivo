# Generates the FORJA app icons (the Forge Ring mark) with GDI+.
# Re-run only when the mark changes; the PNGs are committed as source assets.
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path (Split-Path $PSScriptRoot -Parent) "src\assets\icons"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$obsidian = [System.Drawing.ColorTranslator]::FromHtml("#0A0A0C")
$track    = [System.Drawing.ColorTranslator]::FromHtml("#26262C")
$ember    = [System.Drawing.ColorTranslator]::FromHtml("#FF5A1F")
$gold     = [System.Drawing.ColorTranslator]::FromHtml("#FFC157")

function New-Icon {
    param(
        [int]$Size, [string]$Path,
        [switch]$Maskable, [switch]$Rounded, [switch]$Circle,
        # Transparent background for Android adaptive-icon foregrounds.
        [switch]$Transparent
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $bg = New-Object System.Drawing.SolidBrush $obsidian
    if ($Transparent) {
        $g.Clear([System.Drawing.Color]::Transparent)
    } elseif ($Circle) {
        $g.FillEllipse($bg, 0, 0, $Size, $Size)
    } elseif ($Rounded) {
        # Rounded square for contexts that do not apply their own mask.
        # NOTE: do not name this $path — PowerShell variables are case-insensitive
        # and it would collide with the $Path parameter.
        $r = $Size * 0.22
        $shape = New-Object System.Drawing.Drawing2D.GraphicsPath
        $shape.AddArc(0, 0, 2*$r, 2*$r, 180, 90)
        $shape.AddArc($Size - 2*$r, 0, 2*$r, 2*$r, 270, 90)
        $shape.AddArc($Size - 2*$r, $Size - 2*$r, 2*$r, 2*$r, 0, 90)
        $shape.AddArc(0, $Size - 2*$r, 2*$r, 2*$r, 90, 90)
        $shape.CloseFigure()
        $g.FillPath($bg, $shape)
        $shape.Dispose()
    } else {
        $g.FillRectangle($bg, 0, 0, $Size, $Size)
    }

    # Maskable icons and adaptive foregrounds must keep their content inside the
    # central safe zone: Android only guarantees the middle 72dp of 108dp.
    $radius = if ($Transparent) { $Size * 0.20 } elseif ($Maskable) { $Size * 0.24 } else { $Size * 0.30 }
    $stroke = $radius * 0.34
    $box = New-Object System.Drawing.RectangleF(
        ($Size/2 - $radius), ($Size/2 - $radius), (2*$radius), (2*$radius))

    $trackPen = New-Object System.Drawing.Pen($track, $stroke)
    $trackPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $trackPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($trackPen, $box, 0, 360)

    $emberPen = New-Object System.Drawing.Pen($ember, $stroke)
    $emberPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $emberPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $sweep = 252
    $g.DrawArc($emberPen, $box, -90, $sweep)

    # Leading ember at the tip of the filled arc.
    $angle = (-90 + $sweep) * [Math]::PI / 180
    $tipX = $Size/2 + [Math]::Cos($angle) * $radius
    $tipY = $Size/2 + [Math]::Sin($angle) * $radius
    $tipR = $stroke * 0.46
    $tipBrush = New-Object System.Drawing.SolidBrush $gold
    $g.FillEllipse($tipBrush, ($tipX - $tipR), ($tipY - $tipR), (2*$tipR), (2*$tipR))

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose(); $bmp.Dispose(); $bg.Dispose()
    $trackPen.Dispose(); $emberPen.Dispose(); $tipBrush.Dispose()
    "  {0}  ({1}x{1})" -f (Split-Path $Path -Leaf), $Size
}

"Generating icons in $outDir"
New-Icon -Size 192 -Path (Join-Path $outDir "icon-192.png") -Rounded
New-Icon -Size 512 -Path (Join-Path $outDir "icon-512.png") -Rounded
New-Icon -Size 512 -Path (Join-Path $outDir "icon-maskable-512.png") -Maskable
New-Icon -Size 180 -Path (Join-Path $outDir "apple-touch-icon.png") -Rounded
New-Icon -Size 1024 -Path (Join-Path $outDir "icon-1024.png") -Rounded

# ---- Android launcher icons -------------------------------------------------
# Written straight into the native project so `npm run android` picks them up.
$androidRes = Join-Path (Split-Path $PSScriptRoot -Parent) "android\app\src\main\res"
if (Test-Path $androidRes) {
    "Generating Android launcher icons"
    # Legacy launcher (pre-API 26) and adaptive foreground (108dp) per density.
    $densities = @(
        @{ dir = "mipmap-mdpi";    legacy = 48;  fg = 108 },
        @{ dir = "mipmap-hdpi";    legacy = 72;  fg = 162 },
        @{ dir = "mipmap-xhdpi";   legacy = 96;  fg = 216 },
        @{ dir = "mipmap-xxhdpi";  legacy = 144; fg = 324 },
        @{ dir = "mipmap-xxxhdpi"; legacy = 192; fg = 432 }
    )
    foreach ($d in $densities) {
        $dir = Join-Path $androidRes $d.dir
        if (-not (Test-Path $dir)) { continue }
        New-Icon -Size $d.legacy -Path (Join-Path $dir "ic_launcher.png") -Rounded | Out-Null
        New-Icon -Size $d.legacy -Path (Join-Path $dir "ic_launcher_round.png") -Circle | Out-Null
        New-Icon -Size $d.fg -Path (Join-Path $dir "ic_launcher_foreground.png") -Transparent | Out-Null
        "  $($d.dir)"
    }

    # The adaptive icon draws this colour behind the foreground.
    $bgXml = Join-Path $androidRes "values\ic_launcher_background.xml"
    if (Test-Path $bgXml) {
        @'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0A0A0C</color>
</resources>
'@ | Set-Content -Path $bgXml -Encoding UTF8
        "  values/ic_launcher_background.xml -> #0A0A0C"
    }
}
