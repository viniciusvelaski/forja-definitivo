# Minimal static file server for the FORJA prototype (no Node/Python required).
param([int]$Port = 5180)

$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
} catch {
    # Windows can reserve port ranges (Hyper-V / WSL do this, and reservations
    # survive reboots), which makes an otherwise free port impossible to bind.
    Write-Host "Could not bind port $Port." -ForegroundColor Red
    Write-Host "Check reserved ranges with:  netsh interface ipv4 show excludedportrange protocol=tcp"
    Write-Host "Then start on another port:  .\serve.ps1 -Port 5181"
    Write-Host "(also update `"port`" in .claude\launch.json to match)"
    exit 1
}

Write-Host "FORJA prototype server running at http://localhost:$Port/"

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".ico"  = "image/x-icon"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        try {
            $path = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
            if ($path.EndsWith("/")) { $path = $path + "index.html" }
            $filePath = Join-Path $root ($path.TrimStart("/"))
            $filePath = [System.IO.Path]::GetFullPath($filePath)

            if (-not $filePath.StartsWith($root)) {
                $response.StatusCode = 403
                $response.Close()
                continue
            }

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath)
                $contentType = $mime[$ext]
                if (-not $contentType) { $contentType = "application/octet-stream" }
                $response.ContentType = $contentType
                $response.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate")
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
                $response.OutputStream.Write($notFound, 0, $notFound.Length)
            }
        } catch {
            $response.StatusCode = 500
        } finally {
            $response.Close()
        }
    }
} finally {
    $listener.Stop()
}
