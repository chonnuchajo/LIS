Add-Type -AssemblyName System.Drawing

$srcPath = "c:\Project\LIS\src\assets\icp-ladda-logo.png"
$outPath = "c:\Project\LIS\public\favicon.png"

$src = [System.Drawing.Image]::FromFile($srcPath)
$w = $src.Width
$h = $src.Height
$srcBmp = New-Object System.Drawing.Bitmap($src)

# Lock bits for fast read access (source is 24bpp RGB)
$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$data = $srcBmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$srcBmp.UnlockBits($data)

function IsBlack {
    param([int]$idx)
    return ($bytes[$idx] -lt 20 -and $bytes[$idx+1] -lt 20 -and $bytes[$idx+2] -lt 20)
}

function PixelIdx {
    param([int]$x, [int]$y)
    return ($y * $stride) + ($x * 3)
}

# Background mask: 1 = background (reachable from edge via black)
$bg = New-Object 'byte[]' ($w * $h)
$queue = New-Object System.Collections.Generic.Queue[int]

$hMinus1 = $h - 1
$wMinus1 = $w - 1

# Seed edge pixels
for ($x = 0; $x -lt $w; $x++) {
    foreach ($y in @(0, $hMinus1)) {
        $maskIdx = $y * $w + $x
        if ($bg[$maskIdx] -eq 0 -and (IsBlack (PixelIdx $x $y))) {
            $bg[$maskIdx] = 1
            $queue.Enqueue($maskIdx)
        }
    }
}
for ($y = 0; $y -lt $h; $y++) {
    foreach ($x in @(0, $wMinus1)) {
        $maskIdx = $y * $w + $x
        if ($bg[$maskIdx] -eq 0 -and (IsBlack (PixelIdx $x $y))) {
            $bg[$maskIdx] = 1
            $queue.Enqueue($maskIdx)
        }
    }
}

# BFS using 4 explicit neighbor checks (avoids PS 5.1 array-literal parser quirks)
$dx4 = @(1, -1, 0, 0)
$dy4 = @(0, 0, 1, -1)
while ($queue.Count -gt 0) {
    $cur = $queue.Dequeue()
    $cy = [int][Math]::Floor($cur / $w)
    $cx = $cur - ($cy * $w)
    for ($i = 0; $i -lt 4; $i++) {
        $nx = $cx + $dx4[$i]
        $ny = $cy + $dy4[$i]
        if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $w -or $ny -ge $h) { continue }
        $nMask = $ny * $w + $nx
        if ($bg[$nMask] -ne 0) { continue }
        if (IsBlack (PixelIdx $nx $ny)) {
            $bg[$nMask] = 1
            $queue.Enqueue($nMask)
        }
    }
}

# Build cleaned ARGB bitmap (logo with transparent background)
$cleanBmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$cleanData = $cleanBmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$cleanStride = $cleanData.Stride
$cleanBytes = New-Object byte[] ($cleanStride * $h)
for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $sIdx = ($y * $stride) + ($x * 3)
        $dIdx = ($y * $cleanStride) + ($x * 4)
        $maskIdx = $y * $w + $x
        if ($bg[$maskIdx] -ne 0) {
            $cleanBytes[$dIdx]   = 0  # B
            $cleanBytes[$dIdx+1] = 0  # G
            $cleanBytes[$dIdx+2] = 0  # R
            $cleanBytes[$dIdx+3] = 0  # A (transparent)
        } else {
            $cleanBytes[$dIdx]   = $bytes[$sIdx]      # B
            $cleanBytes[$dIdx+1] = $bytes[$sIdx + 1]  # G
            $cleanBytes[$dIdx+2] = $bytes[$sIdx + 2]  # R
            $cleanBytes[$dIdx+3] = 255                # A (opaque)
        }
    }
}
[System.Runtime.InteropServices.Marshal]::Copy($cleanBytes, 0, $cleanData.Scan0, $cleanBytes.Length)
$cleanBmp.UnlockBits($cleanData)

# Render to square 512x512 with padding
$size = 512
$outBmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($outBmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$padding = 24
$maxW = $size - 2 * $padding
$maxH = $size - 2 * $padding
$scaleW = $maxW / $w
$scaleH = $maxH / $h
$scale = [Math]::Min($scaleW, $scaleH)
$drawW = [int]($w * $scale)
$drawH = [int]($h * $scale)
$dx = [int](($size - $drawW) / 2)
$dy = [int](($size - $drawH) / 2)
$g.DrawImage($cleanBmp, $dx, $dy, $drawW, $drawH)
$g.Dispose()

$outBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$src.Dispose()
$srcBmp.Dispose()
$cleanBmp.Dispose()
$outBmp.Dispose()

$info = Get-Item $outPath
Write-Output ("Saved " + $info.Name + " - " + $info.Length + " bytes, " + $size + "x" + $size)
