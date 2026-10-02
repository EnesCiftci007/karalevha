@echo off
title KaraLevha - Tam Sistem Baslatici
color 0E
echo.
echo  ================================================
echo   KaraLevha Demo Sistemi Baslatiliyor...
echo  ================================================
echo.
echo  [1/2] Backend API sunucusu aciliyor...
start "KaraLevha Backend" cmd /k "cd /d "%~dp0karalevha-backend" && uv run --with fastapi --with uvicorn --with "numpy-stl" --with "python-multipart" --with bcrypt --with PyJWT --with psycopg2-binary python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo  Backend penceresi acildi. 3 saniye bekleniyor...
timeout /t 3 /nobreak >nul

echo  [2/2] Frontend arayuzu aciliyor...
start "KaraLevha Frontend" cmd /k "cd /d "%~dp0karalevha-frontend" && npm start"

echo.
echo  ================================================
echo   Her iki servis de baslatildi!
echo.
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000
echo  ================================================
echo.
echo  Tarayici otomatik acilacak (yaklasik 30 saniye)
echo  Bu pencereyi kapatabilirsiniz.
echo.
pause
