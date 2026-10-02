@echo off
title KaraLevha - Backend (API Sunucusu)
color 0A
echo.
echo  ============================================
echo   KaraLevha Backend Sunucusu Baslatiliyor...
echo   http://localhost:8000
echo  ============================================
echo.
cd /d "%~dp0karalevha-backend"
uv run --with fastapi --with uvicorn --with "numpy-stl" --with "python-multipart" --with bcrypt --with PyJWT --with psycopg2-binary python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
