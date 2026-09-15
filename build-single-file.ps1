# Builds a single self-contained HTML file from the ES module sources.
# Used only to share the prototype with someone who cannot run a local server;
# the app itself is still developed as separate modules.
param(
    [string]$OutFile = "forja-arquivo-unico.html",
    # Artifact hosting supplies its own <!doctype>/<head>/<body>, so that
    # wrapper has to be left out of the published variant.
    [switch]$ForArtifact,
    [string]$OutDir,
    # Pins the entry route, e.g. "/admin" for the review build of the admin area.
    [string]$StartRoute
)

$root = $PSScriptRoot
$srcRoot = Join-Path $root "src"

function Resolve-Spec {
    param([string]$FromFile, [string]$Spec)
    $dir = Split-Path $FromFile -Parent
    return [System.IO.Path]::GetFullPath((Join-Path $dir $Spec))
}

# Depth-first walk from the entry module so dependencies are emitted first.
$ordered = New-Object System.Collections.Generic.List[string]
$visiting = @{}
$visited = @{}

function Visit {
    param([string]$File)
    if ($visited.ContainsKey($File)) { return }
    if ($visiting.ContainsKey($File)) { throw "Import cycle at $File" }
    $visiting[$File] = $true

    $text = [System.IO.File]::ReadAllText($File)
    foreach ($match in [regex]::Matches($text, 'from\s*"(\.[^"]+)"')) {
        Visit (Resolve-Spec -FromFile $File -Spec $match.Groups[1].Value)
    }

    $visiting.Remove($File)
    $visited[$File] = $true
    $ordered.Add($File)
}

Visit (Join-Path $srcRoot "js\main.js")

# Strip module syntax. Every module ends up sharing one function scope, which is
# safe here because the sources are checked for duplicate top-level names.
$chunks = foreach ($file in $ordered) {
    $code = [System.IO.File]::ReadAllText($file)
    $code = [regex]::Replace($code, '(?s)^import\s*\{[^}]*\}\s*from\s*"[^"]+";\s*$', '', 'Multiline')
    $code = [regex]::Replace($code, '(?m)^export\s*\{[^}]*\}\s*from\s*"[^"]+";\s*$', '')
    $code = [regex]::Replace($code, '(?s)^export\s*\{[^}]*\};\s*$', '', 'Multiline')
    $code = [regex]::Replace($code, '(?m)^export\s+(function|const|let|class|async)\b', '$1')
    $relative = $file.Substring($root.Length + 1).Replace('\', '/')
    "// ===== $relative =====`n$code"
}

$js = $chunks -join "`n"

$css = @("src\styles\tokens.css", "src\styles\base.css", "src\styles\components.css") |
    ForEach-Object { [System.IO.File]::ReadAllText((Join-Path $root $_)) }
$css = $css -join "`n"

$fonts = '<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet" />'

$page = @"
<div id="app-frame">
  <a class="skip-link" href="#app">Ir para o conteúdo</a>
  <main id="app"></main>
  <div id="overlay-root"></div>
</div>
<script>
(function () {
"use strict";
$js
})();
</script>
"@

$startRouteScript = if ($StartRoute) { "window.__FORJA_START_ROUTE__ = `"$StartRoute`";" } else { "" }

if ($ForArtifact) {
    # The artifact viewer blocks page-initiated downloads, so the share card's
    # download option is hidden there; copy-to-clipboard still works.
    $html = @"
<title>FORJA</title>
$fonts
<style>
html, body { height: 100%; }
$css
</style>
<script>window.__FORJA_SHARE_DOWNLOAD__ = false; $startRouteScript</script>
$page
"@
} else {
    $html = @"
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>FORJA</title>
<meta name="color-scheme" content="dark" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
$fonts
<style>
$css
</style>
</head>
<body>
$page
</body>
</html>
"@
}

$outPath = if ($OutDir) { Join-Path $OutDir $OutFile } else { Join-Path $root $OutFile }
[System.IO.File]::WriteAllText($outPath, $html, (New-Object System.Text.UTF8Encoding $false))
$sizeKb = [math]::Round((Get-Item $outPath).Length / 1KB)
Write-Host "Built $OutFile from $($ordered.Count) modules ($sizeKb KB)"
