from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
import sqlite3
import uvicorn
import os
import tempfile
import shutil
from typing import Optional
from passlib.context import CryptContext
from stl import mesh  # STL analizi için numpy-stl motoru

app = FastAPI(title="Karalevha Merkezi Backend Motoru v2.4")

# CORS Ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Şifre Hashleme Motoru
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_PASSWORD = "123"
DB_NAME = "karalevha.db"
UPLOAD_DIR = "static/uploads"

# Klasörleri otomatik oluşturuyoruz
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Static klasörünü dış dünyaya servis ediyoruz
app.mount("/static", StaticFiles(directory="static"), name="static")


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
            active INTEGER DEFAULT 1
        )
    ''')
    
    # 2. Kullanıcı Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            auth_provider TEXT DEFAULT 'local',
            display_name TEXT,
            role TEXT DEFAULT 'user',
            profile_image TEXT DEFAULT NULL,
            bio TEXT DEFAULT NULL,
            custom_link TEXT DEFAULT NULL,
            badge TEXT DEFAULT 'Maker',
            kayit_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 3. Forum Kategorileri Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS forum_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT
        )
    ''')

    # 4. Forum Konuları Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS forum_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER,
            user_id INTEGER,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT DEFAULT NULL,
            tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(category_id) REFERENCES forum_categories(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    # 5. Yorumlar Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS forum_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            user_id INTEGER,
            content TEXT NOT NULL,
            parent_id INTEGER DEFAULT NULL,
            image_url TEXT DEFAULT NULL,
            tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(parent_id) REFERENCES forum_comments(id) ON DELETE CASCADE
        )
    ''')
    
    # 6. Merkezi Keşfet Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS discover_feed (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content_type TEXT NOT NULL, 
            content_id INTEGER NOT NULL,   
            tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 7. 3B Baskı Siparişleri Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS print_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NULL,
            isim TEXT NOT NULL,
            telefon TEXT NOT NULL,
            adres TEXT,
            teslimat_yontemi TEXT NOT NULL,
            toplam_fiyat REAL NOT NULL,
            sepet_icerigi TEXT NOT NULL,
            durum TEXT DEFAULT 'Sipariş Alındı',  -- Başlangıç durumu güncellendi
            tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Varsayılan kategoriler
    cursor.execute("SELECT COUNT(*) FROM forum_categories")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO forum_categories (name, description) VALUES ('3D Baskı Hizmeti ve Sorular', 'Siparişler and baskı kalitesi hakkında sorularınız')")
        cursor.execute("INSERT INTO forum_categories (name, description) VALUES ('Donanım ve Maker Dünyası', 'Elektronik, filamentlerและyazıcı modifikasyonları')")

    conn.commit()
    conn.close()

veritabani_hazirla()


# ----------------- PYDANTIC MODELLERİ -----------------

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

class NewCommentModel(BaseModel):
    post_id: int
    user_id: int
    content: str
    parent_id: Optional[int] = None

class UyeGuncellemeModel(BaseModel):
    role: str
    badge: str

class SiparisModel(BaseModel):
    user_id: Optional[int] = None
    isim: str
    telefon: str
    adres: Optional[str] = None
    teslimat_yontemi: str
    toplam_fiyat: float
    sepet_icerigi: str

# v2.4 Sipariş Durumu İçin Yeni Pydantic Şeması
class SiparisDurumModel(BaseModel):
    durum: str


# ----------------- APİ ENDPOINTLERİ -----------------

@app.post("/admin/login")
async def admin_login(req: AdminLoginModel):
    if req.password == ADMIN_PASSWORD:
        return {"status": "success", "message": "Yönetici girişi başarılı"}
    raise HTTPException(status_code=401, detail="Hatalı şifre girdiniz!")


# ----------------- ADMİN PANEL ENTEGRASYONLARI -----------------

@app.get("/api/admin/stats")
async def get_admin_stats():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        kullanici_sayisi = cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        konu_sayisi = cursor.execute("SELECT COUNT(*) FROM forum_posts").fetchone()[0]
        baski_sayisi = cursor.execute("SELECT COUNT(*) FROM print_orders WHERE durum NOT IN ('Teslim Edildi', 'İptal Edildi')").fetchone()[0]
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"İstatistikler okunamadı: {str(e)}")
    conn.close()
    return {
        "kullaniciSayisi": kullanici_sayisi,
        "konuSayisi": konu_sayisi,
        "baskiSayisi": baski_sayisi
    }

@app.get("/api/admin/users")
async def list_users():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    users = cursor.execute("SELECT id, display_name as name, email, role, badge FROM users").fetchall()
    conn.close()
    return [dict(row) for row in users]

@app.put("/api/admin/users/{user_id}")
async def update_user_auth(user_id: int, data: UyeGuncellemeModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET role = ?, badge = ? WHERE id = ?", (data.role, data.badge, user_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/admin/orders")
async def list_orders():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        orders = cursor.execute("SELECT * FROM print_orders ORDER BY tarih DESC").fetchall()
        result = [dict(row) for row in orders]
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Sipariş listesi alınamadı: {str(e)}")
    finally:
        conn.close()
    return result

# v2.4 Sipariş Durumunu Değiştiren Yeni Endpoint
@app.put("/api/admin/orders/{order_id}/status")
async def update_order_status(order_id: int, data: SiparisDurumModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE print_orders SET durum = ? WHERE id = ?", (data.durum, order_id))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Durum güncellenemedi: {str(e)}")
    finally:
        conn.close()
    return {"status": "success", "message": "Sipariş durumu veritabanında güncellendi reis!"}


# ----------------- MÜŞTERİ SİPARİŞ ENDPOINT'İ -----------------

@app.post("/api/orders")
async def create_order(order: SiparisModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute(
            """INSERT INTO print_orders (user_id, isim, telefon, adres, teslimat_yontemi, toplam_fiyat, sepet_icerigi) 
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (order.user_id, order.isim, order.telefon, order.adres, order.teslimat_yontemi, order.toplam_fiyat, order.sepet_icerigi)
        )
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Sipariş hatası: {str(e)}")
    finally:
        conn.close()
    return {"status": "success"}


# ----------------- FİLAMENT SİSTEMİ -----------------

@app.get("/filaments")
async def get_filaments():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM filaments")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

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

@app.delete("/filaments/{f_id}")
async def delete_filament(f_id: str):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM filaments WHERE id = ?", (f_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


# ----------------- STL ANALİZ VE SUNUCUYA KAYDETME MOTORU -----------------

@app.post("/analyze")
async def analyze_file(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.stl'):
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir .STL dosyası yükleyin.")

    try:
        file_extension = os.path.splitext(file.filename)[1]
        custom_filename = f"model_{tempfile.mktemp().split(os.sep)[-1]}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, custom_filename)
        
        content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        your_mesh = mesh.Mesh.from_file(file_path)
        volume, _, _ = your_mesh.get_mass_properties()
        
        minx, maxx = your_mesh.x.min(), your_mesh.x.max()
        miny, maxy = your_mesh.y.min(), your_mesh.y.max()
        minz, maxz = your_mesh.z.min(), your_mesh.z.max()
        
        dim_x = round(maxx - minx, 1)
        dim_y = round(maxy - miny, 1)
        dim_z = round(maxz - minz, 1)
        dimensions_str = f"{dim_x}x{dim_y}x{dim_z} mm"

        if volume <= 0:
            volume = 0

        saved_file_url = f"http://localhost:8000/static/uploads/{custom_filename}"

        return {
            "status": "success",
            "volume": float(volume),             
            "dimensions": dimensions_str,
            "fileUrl": saved_file_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STL analiz hatası: {str(e)}")


# ----------------- FORUM SİSTEMİ VE PROFİL ENDPOINTLERİ -----------------
# (Mevcut işlevselliği korumak adına eski kod şeman aynen aşağıya bağlandı reis)

@app.put("/api/user/profile")
async def update_user_profile(user_id: int = Form(...), display_name: str = Form(...), bio: Optional[str] = Form(None), custom_link: Optional[str] = Form(None), file: Optional[UploadFile] = File(None)):
    conn = sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row; cursor = conn.cursor()
    user = cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user: conn.close(); raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    profile_image_url = user["profile_image"]
    if file and file.filename:
        fe = os.path.splitext(file.filename)[1]; cf = f"avatar_{user_id}_{tempfile.mktemp().split(os.sep)[-1]}{fe}"; fp = os.path.join(UPLOAD_DIR, cf)
        with open(fp, "wb") as b: shutil.copyfileobj(file.file, b)
        profile_image_url = f"http://localhost:8000/static/uploads/{cf}"
    try:
        cursor.execute("UPDATE users SET display_name = ?, bio = ?, custom_link = ?, profile_image = ? WHERE id = ?", (display_name, bio, custom_link, profile_image_url, user_id)); conn.commit()
        up = cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone(); conn.close()
        return {"status": "success", "user": {"id": up["id"], "email": up["email"], "display_name": up["display_name"], "role": up["role"], "bio": up["bio"], "custom_link": up["custom_link"], "badge": up["badge"], "profile_image": up["profile_image"]}}
    except Exception as e: conn.close(); raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/forum/categories")
async def get_forum_categories():
    conn = sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row; cursor = conn.cursor(); rows = cursor.execute("SELECT * FROM forum_categories").fetchall(); conn.close(); return [dict(r) for r in rows]

@app.get("/api/forum/categories/{category_id}/posts")
async def get_category_posts(category_id: int):
    conn = sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row; cursor = conn.cursor(); rows = cursor.execute("SELECT fp.*, u.display_name, u.profile_image, u.badge FROM forum_posts fp JOIN users u ON fp.user_id = u.id WHERE fp.category_id = ? ORDER BY fp.tarih DESC", (category_id,)).fetchall(); conn.close(); return [dict(r) for r in rows]

@app.post("/api/forum/posts")
async def create_forum_post(category_id: int = Form(...), user_id: int = Form(...), title: str = Form(...), content: str = Form(...), file: Optional[UploadFile] = File(None)):
    conn = sqlite3.connect(DB_NAME); cursor = conn.cursor(); img = None
    if file and file.filename:
        fe = os.path.splitext(file.filename)[1]; cf = f"post_{tempfile.mktemp().split(os.sep)[-1]}{fe}"; fp = os.path.join(UPLOAD_DIR, cf)
        with open(fp, "wb") as b: shutil.copyfileobj(file.file, b)
        img = f"http://localhost:8000/static/uploads/{cf}"
    try:
        cursor.execute("INSERT INTO forum_posts (category_id, user_id, title, content, image_url) VALUES (?, ?, ?, ?, ?)", (category_id, user_id, title, content, img)); pid = cursor.lastrowid
        cursor.execute("INSERT INTO discover_feed (content_type, content_id) VALUES ('forum_post', ?)", (pid,)); conn.commit()
    except Exception as e: conn.rollback(); conn.close(); raise HTTPException(status_code=500, detail=str(e))
    finally: conn.close()
    return {"status": "success"}

@app.delete("/api/forum/posts/{post_id}")
async def delete_forum_post(post_id: int, user_id: int):
    conn = sqlite3.connect(DB_NAME); cursor = conn.cursor(); p = cursor.execute("SELECT user_id FROM forum_posts WHERE id = ?", (post_id,)).fetchone()
    if not p: conn.close(); raise HTTPException(status_code=404, detail="Gönderi bulunamadı.")
    u = cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    if p[0] != user_id and (not u or u[0] != 'admin'): conn.close(); raise HTTPException(status_code=403, detail="Yetkisiz işlem.")
    try: cursor.execute("DELETE FROM forum_posts WHERE id = ?", (post_id,)); cursor.execute("DELETE FROM discover_feed WHERE content_type = 'forum_post' AND content_id = ?", (post_id,)); conn.commit()
    except Exception as e: conn.rollback(); conn.close(); raise HTTPException(status_code=500, detail=str(e))
    finally: conn.close()
    return {"status": "success"}

@app.get("/api/forum/posts/all")
async def get_all_posts():
    conn = sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row; cursor = conn.cursor(); rows = cursor.execute("SELECT fp.*, u.display_name, u.profile_image, u.badge, c.name as category_name FROM forum_posts fp JOIN users u ON fp.user_id = u.id JOIN forum_categories c ON fp.category_id = c.id ORDER BY fp.tarih DESC").fetchall(); conn.close(); return [dict(r) for r in rows]

@app.post("/api/forum/comments")
async def create_comment(comment: NewCommentModel):
    conn = sqlite3.connect(DB_NAME); cursor = conn.cursor()
    try: cursor.execute("INSERT INTO forum_comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)", (comment.post_id, comment.user_id, comment.content, comment.parent_id)); conn.commit()
    except Exception as e: conn.close(); raise HTTPException(status_code=500, detail=str(e))
    finally: conn.close()
    return {"status": "success"}

@app.get("/api/forum/posts/{post_id}/comments")
async def get_post_comments(post_id: int):
    conn = sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row; cursor = conn.cursor(); rows = cursor.execute("SELECT fc.*, u.display_name, u.profile_image, u.badge FROM forum_comments fc JOIN users u ON fc.user_id = u.id WHERE fc.post_id = ? ORDER BY fc.tarih ASC", (post_id,)).fetchall(); conn.close(); return [dict(r) for r in rows]

@app.get("/api/user/{user_id}/posts")
async def get_user_posts(user_id: int):
    conn = sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row; cursor = conn.cursor(); rows = cursor.execute("SELECT fp.*, c.name as category_name FROM forum_posts fp JOIN forum_categories c ON fp.category_id = c.id WHERE fp.user_id = ? ORDER BY fp.tarih DESC", (user_id,)).fetchall(); conn.close(); return [dict(r) for r in rows]

@app.get("/api/discover/feed")
async def get_discover_feed():
    conn = sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row; cursor = conn.cursor(); fi = cursor.execute("SELECT * FROM discover_feed ORDER BY tarih DESC").fetchall(); agg = []
    for item in fi:
        if item["content_type"] == "forum_post":
            p = cursor.execute("SELECT fp.id, fp.title, fp.content, fp.tarih, u.display_name, 'forum_post' as type FROM forum_posts fp JOIN users u ON fp.user_id = u.id WHERE fp.id = ?", (item["content_id"],)).fetchone()
            if p: agg.append(dict(p))
    conn.close(); return agg

@app.post("/api/auth/register")
async def register_user(u: KayitModel):
    conn = sqlite3.connect(DB_NAME); cursor = conn.cursor()
    try: hp = pwd_context.hash(u.password); cursor.execute("INSERT INTO users (email, password_hash, display_name, auth_provider, role, badge) VALUES (?, ?, ?, 'local', 'user', 'Maker')", (u.email, hp, u.display_name)); conn.commit()
    except sqlite3.IntegrityError: conn.close(); raise HTTPException(status_code=400, detail="E-posta kayıtlı!")
    finally: conn.close()
    return {"status": "success"}

@app.post("/api/auth/login")
async def login_user(req: UserLoginModel):
    conn = sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row; cursor = conn.cursor(); user = cursor.execute("SELECT * FROM users WHERE email = ?", (req.email,)).fetchone(); conn.close()
    if not user or not pwd_context.verify(req.password, user["password_hash"]): raise HTTPException(status_code=401, detail="Hatalı giriş!")
    return {"status": "success", "user": {"id": user["id"], "email": user["email"], "display_name": user["display_name"], "role": user["role"], "bio": user["bio"], "custom_link": user["custom_link"], "badge": user["badge"], "profile_image": user["profile_image"]}}

if __name__ == "__main__":
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)