# Assembles the web assets into www/, which is what Capacitor copies into the
# native projects (capacitor.config.json -> webDir). Also the exact folder to
# upload to a static host for the web/PWA build.
$root = Split-Path $PSScriptRoot -Parent
$www = Join-Path $root "www"

if (Test-Path $www) { Remove-Item $www -Recurse -Force }
New-Item -ItemType Directory -Path $www -Force | Out-Null

# Everything the app needs at runtime, and nothing else.
foreach ($file in @("index.html", "manifest.webmanifest", "sw.js")) {
    Copy-Item (Join-Path $root $file) -Destination $www
}
Copy-Item (Join-Path $root "src") -Destination $www -Recurse

$count = (Get-ChildItem $www -Recurse -File).Count
"Built www/ with $count files"
