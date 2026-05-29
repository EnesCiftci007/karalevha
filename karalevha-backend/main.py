from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import uvicorn
from typing import Optional
from passlib.context import CryptContext

app = FastAPI(title="Karalevha Merkezi Backend Motoru")

# CORS Ayarları (React ile güvenli haberleşme için)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Şifre Hashleme Motoru (Güvenlik için)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_PASSWORD = "123" # Admin paneli şifresi sabit kalabilir

# VERİTABANI BAĞLANTISI VE TABLOLARIN OLUŞTURULMASI
DB_NAME = "karalevha.db"

def veritabani_hazirla():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # 1. Filamentler Tablosu (Eski baskı torbacısından miras)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS filaments (
            id TEXT PRIMARY KEY,
            type TEXT,
            colorName TEXT,
            colorHex TEXT,
            active INTEGER
        )
    ''')
    
    # 2. GELECEĞE HAZIR MERKEZİ KULLANICI TABLOSU (Forum, Baskı, Google Girişi Ortak)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT, -- Google ile girenler için NULL (boş) kalabilir!
            auth_provider TEXT DEFAULT 'local', -- 'local' veya 'google'
            display_name TEXT, -- Forumda görünecek isim
            role TEXT DEFAULT 'user', -- 'user', 'maker', 'admin'
            kayit_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

veritabani_hazirla()

# Pydantic Modelleri (Veri Kalıpları)
class LoginRequest(BaseModel):
    password: str

class FilamentModel(BaseModel):
    id: str
    type: str
    colorName: str
    colorHex: str
    active: bool

class KayitModel(BaseModel):
    email: str
    password: str
    display_name: str

# ----------------- APİ ENDPOINTLERİ -----------------

# Admin Giriş Doğrulaması (Gizli URL için)
@app.post("/admin/login")
async def admin_login(req: LoginRequest):
    if req.password == ADMIN_PASSWORD:
        return {"status": "success", "message": "Yönetici girişi başarılı"}
    raise HTTPException(status_code=401, detail="Hatalı şifre girdiniz!")

# Filamentleri Listele
@app.get("/filaments")
async def get_filaments():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM filaments")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# Filament Ekle
@app.post("/filaments")
async def add_filament(f: FilamentModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO filaments (id, type, colorName, colorHex, active) VALUES (?, ?, ?, ?, ?)",
            (f.id, f.type, f.colorName, f.colorHex, 1 if f.active else 0)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Bu ID zaten mevcut.")
    conn.close()
    return {"status": "success"}

# Filament Sil
@app.delete("/filaments/{f_id}")
async def delete_filament(f_id: str):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM filaments WHERE id = ?", (f_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

# Model Analiz Taklidi (Şimdilik frontend patlamasın diye eski yapıyı koruyoruz)
@app.post("/analyze")
async def analyze_file():
    # Gerçek analiz kodlarını veya kütüphanelerini buraya ekleyebiliriz
    return {
        "status": "success",
        "volume": 25000,
        "dimensions": "50x50x50"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)