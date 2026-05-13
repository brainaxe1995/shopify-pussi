# Download 7 product images from live pussikauppa.com homepage uploads.
# Live product /product/<slug>/ pages return 404, so we map directly to the
# homepage product PNGs and rename to match the seed CSV product handles.

$dest = $PSScriptRoot
$map = @{
  "odens-cold-dry-extreme-white.png" = "https://pussikauppa.com/wp-content/uploads/2026/04/Gemini_Generated_Image_808i07808i07808i-Photoroom-600x600.png"
  "white-fox-original.png"           = "https://pussikauppa.com/wp-content/uploads/2026/04/white-fox.png"
  "white-fox-double-mint.png"        = "https://pussikauppa.com/wp-content/uploads/2026/04/white-fox-mint.png"
  "white-fox-peppered-mint.png"      = "https://pussikauppa.com/wp-content/uploads/2026/04/white-fox-pepert.png"
  "velo-freezing-peppermint.png"     = "https://pussikauppa.com/wp-content/uploads/2026/04/velo-1.png"
  "velo-crispy-peppermint.png"       = "https://pussikauppa.com/wp-content/uploads/2026/04/velo-2-600x600.png"
  "greatest-white-gold-cold-dry.png" = "https://pussikauppa.com/wp-content/uploads/2026/04/greatest.png"
}

foreach ($name in $map.Keys) {
  $url = $map[$name]
  $out = Join-Path $dest $name
  Write-Host "Downloading $name ..."
  # curl.exe is more reliable than Invoke-WebRequest for this origin
  & curl.exe -sSL -A "Mozilla/5.0 (Windows NT 10.0)" -o $out $url
  if (Test-Path $out) {
    Write-Host ("  -> {0} bytes" -f (Get-Item $out).Length)
  } else {
    Write-Warning "  FAILED: $url"
  }
}

Write-Host ""
Write-Host "Done. Product images saved to: $dest"
