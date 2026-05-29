from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import sqlite3
import uvicorn
import os
import tempfile
from typing import Optional
from passlib.context import CryptContext
from stl import mesh  # STL analizi için numpy-stl motoru

app = FastAPI(title="Karalevha Merkezi Backend Motoru v2.2")

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

ADMIN_PASSWORD = "123"  # Admin paneli şifresi

# VERİTABANI BAĞLANTISI VE TABLOLARIN OLUŞTURULMASI
DB_NAME = "karalevha.db"

def veritabani_hazirla():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # 1. Filamentler Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS filaments (
            id TEXT PRIMARY KEY,
            type TEXT,
            colorName TEXT,
            colorHex TEXT,
            active INTEGER
        )
    ''')
    
    # 2. Merkezi Kullanıcı Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            auth_provider TEXT DEFAULT 'local',
            display_name TEXT,
            role TEXT DEFAULT 'user',
            kayit_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

veritabani_hazirla()

# ----------------- PYDANTIC MODELLERİ (VERI KALIPLARI) -----------------

class AdminLoginModel(BaseModel):
    password: str

class FilamentModel(BaseModel):
    id: str
    type: str
    colorName: str
    colorHex: str
    active: bool

class KayitModel(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    
class UserLoginModel(BaseModel):
    email: EmailStr
    password: str


# ----------------- APİ ENDPOINTLERİ -----------------

# Admin Giriş Doğrulaması
@app.post("/admin/login")
async def admin_login(req: AdminLoginModel):
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


# ----------------- GERÇEK STL MODEL ANALİZ MOTORU -----------------
@app.post("/analyze")
async def analyze_file(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.stl'):
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir .STL dosyası yükleyin.")

    try:
        # Gelen dosya akışını geçici bir dosyaya güvenle yazıyoruz
        with tempfile.NamedTemporaryFile(delete=False, suffix=".stl") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # numpy-stl ile 3B modeli okuyoruz
        your_mesh = mesh.Mesh.from_file(tmp_path)
        
        # mm3 cinsinden gerçek hacim hesabı
        volume, cog, inertia = your_mesh.get_mass_properties()
        
        # Model sınır boyutu (Bounding Box) hesaplama
        minx, maxx = your_mesh.x.min(), your_mesh.x.max()
        miny, maxy = your_mesh.y.min(), your_mesh.y.max()
        minz, maxz = your_mesh.z.min(), your_mesh.z.max()
        
        dim_x = round(maxx - minx, 1)
        dim_y = round(maxy - miny, 1)
        dim_z = round(maxz - minz, 1)
        dimensions_str = f"{dim_x}x{dim_y}x{dim_z} mm"

        # İşlem bitince geçici dosyayı temizle
        os.remove(tmp_path)

        if volume <= 0:
            volume = 0

        return {
            "status": "success",
            "volume": float(volume),             # mm3 cinsinden net dinamik hacim
            "dimensions": dimensions_str         # Gerçek boyutlar
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STL dosyası analiz edilirken hata oluştu: {str(e)}")


# ----------------- ÜYELİK SİSTEMİ ENDPOINTLERİ -----------------

# Kullanıcı Kayıt Olma
@app.post("/api/auth/register")
async def register_user(u: KayitModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        hashed_password = pwd_context.hash(u.password)
        cursor.execute(
            """INSERT INTO users (email, password_hash, display_name, auth_provider, role) 
               VALUES (?, ?, ?, 'local', 'user')""",
            (u.email, hashed_password, u.display_name)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı!")
    finally:
        conn.close()
        
    return {"status": "success", "message": "Kayıt başarıyla tamamlandı!"}

# Kullanıcı Giriş Yapma
@app.post("/api/auth/login")
async def login_user(req: UserLoginModel):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE email = ?", (req.email,))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı!")
        
    if user["auth_provider"] == "google":
        raise HTTPException(status_code=400, detail="Bu hesap Google ile oluşturulmuş. Lütfen Google ile giriş yapın.")
        
    if not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı!")
        
    return {
        "status": "success",
        "message": "Giriş başarılı",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "display_name": user["display_name"],
            "role": user["role"]
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)