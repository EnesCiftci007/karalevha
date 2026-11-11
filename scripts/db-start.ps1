# Yerel gelistirme PostgreSQL sunucusunu baslatir (yonetici yetkisi gerekmez).
# Veriler OneDrive disinda, kullanici profilinde tutulur: %LOCALAPPDATA%\Karalevha\pgdata
#
# Kullanim:  .\scripts\db-start.ps1
# Durdurma:  .\scripts\db-stop.ps1

$ErrorActionPreference = 'Stop'

$pgBin = if ($env:KARALEVHA_PG_BIN) { $env:KARALEVHA_PG_BIN } else {
    Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Name -replace '\D', '') } -Descending |
        ForEach-Object { Join-Path $_.FullName 'bin' } |
        Where-Object { Test-Path (Join-Path $_ 'pg_ctl.exe') } |
        Select-Object -First 1
}
if (-not $pgBin) { throw 'PostgreSQL bulunamadi. Kurun ya da KARALEVHA_PG_BIN ortam degiskenini bin klasorune ayarlayin.' }

$data = Join-Path $env:LOCALAPPDATA 'Karalevha\pgdata'
if (-not (Test-Path (Join-Path $data 'PG_VERSION'))) {
    throw "Veritabani kumesi yok: $data  (README'deki 'Yerel veritabani' bolumune bakin)"
}

& "$pgBin\pg_isready.exe" -h localhost -p 5432 -q
if ($LASTEXITCODE -eq 0) { Write-Host 'PostgreSQL zaten calisiyor (localhost:5432).'; exit 0 }

# Start-Process: sunucu bu terminalden bagimsiz calissin, pencere kapaninca olmesin
Start-Process -FilePath "$pgBin\pg_ctl.exe" -WindowStyle Hidden -ArgumentList @(
    'start', '-D', "`"$data`"", '-l', "`"$(Join-Path $data 'server.log')`""
)

foreach ($i in 1..30) {
    Start-Sleep -Milliseconds 500
    & "$pgBin\pg_isready.exe" -h localhost -p 5432 -q
    if ($LASTEXITCODE -eq 0) { Write-Host 'PostgreSQL basladi (localhost:5432).'; exit 0 }
}
throw "PostgreSQL baslatilamadi. Gunluk: $(Join-Path $data 'server.log')"
