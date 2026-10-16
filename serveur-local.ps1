# =====================================================================
#  REVISIONS - petit serveur web local (pour tester l'appli sur ton PC)
#  ---------------------------------------------------------------------
#  Lance par lancer-local.bat. Sert le dossier de ce script sur
#  http://localhost:8080 (ou le port libre suivant) et ouvre le navigateur.
#  Aucun logiciel a installer : utilise PowerShell, present sur Windows.
#  Pour arreter : fermer cette fenetre.
# =====================================================================
param([int]$Port = 8080)

$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.ico'  = 'image/x-icon'
  '.woff2'= 'font/woff2'
  '.woff' = 'font/woff'
  '.ttf'  = 'font/ttf'
  '.pdf'  = 'application/pdf'
  '.md'   = 'text/plain; charset=utf-8'
  '.txt'  = 'text/plain; charset=utf-8'
}

# Cherche un port libre a partir de $Port.
$listener = $null
for ($p = $Port; $p -lt $Port + 20; $p++) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$p/")
    $l.Start()
    $listener = $l; $Port = $p; break
  } catch { }
}
if (-not $listener) { Write-Host "Aucun port libre trouve entre $Port et $($Port+19)." -ForegroundColor Red; Read-Host "Appuie sur Entree"; exit 1 }

$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "  Revisions - serveur local demarre" -ForegroundColor Cyan
Write-Host "  Adresse : $url"
Write-Host "  Dossier : $root"
Write-Host "  Pour arreter : ferme cette fenetre."
Write-Host ""
try { Start-Process $url } catch { Write-Host "  Ouvre $url dans ton navigateur." }

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $chemin = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
      if ($chemin.EndsWith('/')) { $chemin += 'index.html' }
      $fichier = [System.IO.Path]::GetFullPath((Join-Path $root ($chemin.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar))))
      if ($fichier.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $fichier -PathType Leaf)) {
        $ext = [System.IO.Path]::GetExtension($fichier).ToLower()
        if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] } else { $res.ContentType = 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-cache')
        $octets = [System.IO.File]::ReadAllBytes($fichier)
        $res.ContentLength64 = $octets.Length
        $res.OutputStream.Write($octets, 0, $octets.Length)
        Write-Host ("200  " + $chemin)
      } else {
        $res.StatusCode = 404
        Write-Host ("404  " + $chemin) -ForegroundColor Yellow
      }
    } catch {
      $res.StatusCode = 500
      Write-Host ("500  " + $_.Exception.Message) -ForegroundColor Red
    } finally {
      $res.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
}
