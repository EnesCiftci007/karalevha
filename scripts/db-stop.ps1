# Yerel gelistirme PostgreSQL sunucusunu durdurur.

$ErrorActionPreference = 'Stop'

$pgBin = if ($env:KARALEVHA_PG_BIN) { $env:KARALEVHA_PG_BIN } else {
    Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Name -replace '\D', '') } -Descending |
        ForEach-Object { Join-Path $_.FullName 'bin' } |
        Where-Object { Test-Path (Join-Path $_ 'pg_ctl.exe') } |
        Select-Object -First 1
}
if (-not $pgBin) { throw 'PostgreSQL bulunamadi.' }

$data = Join-Path $env:LOCALAPPDATA 'Karalevha\pgdata'
& "$pgBin\pg_ctl.exe" stop -D $data -m fast
