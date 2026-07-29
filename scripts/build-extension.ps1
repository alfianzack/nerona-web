# Membangun ulang public/nerona-metadata.zip dari repo extension.
#
# Jalankan setiap kali nerona_medata berubah. ZIP itu artefak yang ikut di-commit
# (Vercel tidak punya akses ke repo extension saat build), jadi kalau skrip ini
# tidak dijalankan, user mengunduh versi lama tanpa tanda apa pun.
#
#   powershell -ExecutionPolicy Bypass -File scripts/build-extension.ps1
#
# CATATAN: berkas ini sengaja murni ASCII. PowerShell 5.1 membaca .ps1 tanpa BOM
# sebagai ANSI, sehingga em dash UTF-8 berubah menjadi tanda kutip melengkung yang
# ikut dianggap pembatas string dan merusak parsing.
#
# Daftar file diturunkan dari manifest.json, BUKAN disalin buta - berkas yang tidak
# dirujuk manifest (docs, QA_CHECKLIST, .cursor, ikon tak terpakai) tidak ikut.
# popup.css/js dan icons/logo-nerona.svg ditambahkan manual karena dirujuk dari
# popup.html, bukan dari manifest.
param(
  [string]$Source = "..\nerona_medata",
  [string]$Output = "public\nerona-metadata.zip",
  # Semua berkas dibungkus dalam satu folder ini. Tanpa pembungkus, "Extract Here"
  # di 7-Zip/WinRAR menghambur 26 berkas ke folder yang sedang dibuka, dan user
  # kehilangan jejak mana yang harus dipilih saat Load unpacked.
  #
  # Catatan kalau nanti diunggah ke Chrome Web Store: validator di sana menuntut
  # manifest.json ada di ROOT zip, jadi untuk keperluan itu jalankan dengan
  # -Wrapper "" supaya pembungkusnya dilepas.
  [string]$Wrapper = "nerona-metadata"
)
$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$src = Resolve-Path (Join-Path $root $Source)
$outPath = Join-Path $root $Output

$manifest = Get-Content (Join-Path $src "manifest.json") -Raw | ConvertFrom-Json

$files = New-Object System.Collections.Generic.List[string]
$files.Add("manifest.json")
$files.Add($manifest.background.service_worker)
$files.Add($manifest.action.default_popup)
foreach ($cs in $manifest.content_scripts) { foreach ($j in $cs.js) { $files.Add($j) } }
foreach ($p in $manifest.icons.PSObject.Properties) { $files.Add($p.Value) }
# Dirujuk dari popup.html, tidak terlihat oleh manifest.
$files.Add("popup.css")
$files.Add("popup.js")
$files.Add("icons/logo-nerona.svg")
$files = $files | Select-Object -Unique

# Gagal keras kalau manifest merujuk berkas yang tidak ada - lebih baik daripada
# mengirim paket yang langsung ditolak Chrome.
$missing = $files | Where-Object { -not (Test-Path (Join-Path $src $_)) }
if ($missing) { throw "Berkas dirujuk tapi tidak ada: $($missing -join ', ')" }

# Peringatan rilis: paket yang menunjuk localhost tidak bisa dipakai user.
$configText = Get-Content (Join-Path $src "access\access-config.js") -Raw
$localPattern = 'neronaWebBaseUrl:\s*.http:' + [char]0x2F + [char]0x2F + '(localhost|127)'
if ($configText -match $localPattern) {
  Write-Warning "access-config.js masih menunjuk localhost - paket ini tidak akan bisa menghubungi produksi."
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$bs = [System.IO.Path]::DirectorySeparatorChar
$sl = [char]0x2F

# Ditulis lewat API .NET, bukan Compress-Archive: Compress-Archive di PowerShell 5.1
# memakai backslash sebagai pemisah entri, yang melanggar spesifikasi ZIP dan bisa
# salah diekstrak di luar Windows, termasuk oleh validator Chrome Web Store.
$fs = [System.IO.File]::Open($outPath, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
$prefix = ""
if ($Wrapper) { $prefix = $Wrapper + $sl }
foreach ($f in ($files | Sort-Object)) {
  $name = $prefix + $f.Replace($bs, $sl)
  $entry = $archive.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
  $es = $entry.Open()
  $bytes = [System.IO.File]::ReadAllBytes((Join-Path $src $f))
  $es.Write($bytes, 0, $bytes.Length)
  $es.Dispose()
}
$archive.Dispose()
$fs.Dispose()

$sizeKb = (Get-Item $outPath).Length / 1KB
Write-Output ("OK: {0} berkas, {1:N0} KB -> {2}" -f $files.Count, $sizeKb, $Output)
