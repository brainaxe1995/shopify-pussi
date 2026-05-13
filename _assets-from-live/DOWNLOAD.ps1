# Download all live pussikauppa.com images used by the theme.
# Run from project root:  cd shopify-clone\_assets-from-live ;  ./DOWNLOAD.ps1

$urls = @(
  "https://pussikauppa.com/wp-content/uploads/2026/04/hero-2.png",
  "https://pussikauppa.com/wp-content/uploads/2026/04/hero2.png",
  "https://pussikauppa.com/wp-content/uploads/2026/04/ice.jpg",
  "https://pussikauppa.com/wp-content/uploads/2026/04/ice2.jpg",
  "https://pussikauppa.com/wp-content/uploads/2026/04/ice3.jpg",
  # Brand icons (live URLs are .webp but 404; use product PNGs instead)
  # Saved as odens-icon.png etc. via the rename pass below.
  "https://pussikauppa.com/wp-content/uploads/2026/04/Gemini_Generated_Image_808i07808i07808i-Photoroom-600x600.png",
  "https://pussikauppa.com/wp-content/uploads/2026/04/white-fox.png",
  "https://pussikauppa.com/wp-content/uploads/2026/04/velo-1.png",
  "https://pussikauppa.com/wp-content/uploads/2026/04/greatest.png",
  "https://pussikauppa.com/wp-content/uploads/2026/04/about.jpg",
  "https://pussikauppa.com/wp-content/uploads/2026/04/pouche.jpeg"
)

$dest = $PSScriptRoot
foreach ($u in $urls) {
  $name = Split-Path $u -Leaf
  $out  = Join-Path $dest $name
  Write-Host "Downloading $name ..."
  try {
    Invoke-WebRequest -Uri $u -OutFile $out -UseBasicParsing -ErrorAction Stop
  } catch {
    Write-Warning "FAILED: $u -- $_"
  }
}

# Rename brand icons to match theme + seed CSV references.
$rename = @{
  "Gemini_Generated_Image_808i07808i07808i-Photoroom-600x600.png" = "odens-icon.png"
  "white-fox.png"                                                 = "whitefox-icon.png"
  "velo-1.png"                                                    = "velo-icon.png"
  "greatest.png"                                                  = "greatest-icon.png"
}
foreach ($src in $rename.Keys) {
  $srcPath = Join-Path $dest $src
  $dstPath = Join-Path $dest $rename[$src]
  if (Test-Path $srcPath) { Copy-Item $srcPath $dstPath -Force }
}

Write-Host ""
Write-Host "Done. Files saved to: $dest"
Write-Host "Next: Shopify Admin -> Content -> Files -> Upload files -> drag all from this folder."
