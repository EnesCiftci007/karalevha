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

# Görseller için gerekli klasörü otomatik oluşturuyoruz
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Yüklenen resimleri dış dünyaya servis etmek için static klasörünü bağlıyoruz
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
            active INTEGER
        )
    ''')
    
    # 2. Geliştirilmiş Merkezi Kullanıcı Tablosu (v2.4 - Üye Profil Sütunları Eklendi)
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
    
    # Varsayılan başlangıç kategorilerini ekleme
    cursor.execute("SELECT COUNT(*) FROM forum_categories")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO forum_categories (name, description) VALUES ('3D Baskı Hizmeti ve Sorular', 'Siparişler and baskı kalitesi hakkında sorularınız')")
        cursor.execute("INSERT INTO forum_categories (name, description) VALUES ('Donanım ve Maker Dünyası', 'Elektronik, filamentler ve yazıcı modifikasyonları')")

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


# ----------------- APİ ENDPOINTLERİ -----------------

@app.post("/admin/login")
async def admin_login(req: AdminLoginModel):
    if req.password == ADMIN_PASSWORD:
        return {"status": "success", "message": "Yönetici girişi başarılı"}
    raise HTTPException(status_code=401, detail="Hatalı şifre girdiniz!")

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


# ----------------- GERÇEK STL MODEL ANALİZ MOTORU -----------------
@app.post("/analyze")
async def analyze_file(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.stl'):
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir .STL dosyası yükleyin.")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".stl") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        your_mesh = mesh.Mesh.from_file(tmp_path)
        volume, cog, inertia = your_mesh.get_mass_properties()
        
        minx, maxx = your_mesh.x.min(), your_mesh.x.max()
        miny, maxy = your_mesh.y.min(), your_mesh.y.max()
        minz, maxz = your_mesh.z.min(), your_mesh.z.max()
        
        dim_x = round(maxx - minx, 1)
        dim_y = round(maxy - miny, 1)
        dim_z = round(maxz - minz, 1)
        dimensions_str = f"{dim_x}x{dim_y}x{dim_z} mm"

        os.remove(tmp_path)

        if volume <= 0:
            volume = 0

        return {
            "status": "success",
            "volume": float(volume),             
            "dimensions": dimensions_str         
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STL dosyası analiz edilirken hata oluştu: {str(e)}")


# ----------------- ÜYE PROFİL GÜNCELLEME MOTORU (v2.4 yeni) -----------------

@app.put("/api/user/profile")
async def update_user_profile(
    user_id: int = Form(...),
    display_name: str = Form(...),
    bio: Optional[str] = Form(None),
    custom_link: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Kullanıcının mevcut bilgilerini kontrol et
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
        
    profile_image_url = user["profile_image"]

    # Eğer yeni bir profil resmi yüklendiyse diske kaydet
    if file and file.filename:
        file_extension = os.path.splitext(file.filename)[1]
        custom_filename = f"avatar_{user_id}_{tempfile.mktemp().split(os.sep)[-1]}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, custom_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        profile_image_url = f"http://localhost:8000/static/uploads/{custom_filename}"

    try:
        cursor.execute("""
            UPDATE users 
            SET display_name = ?, bio = ?, custom_link = ?, profile_image = ?
            WHERE id = ?
        """, (display_name, bio, custom_link, profile_image_url, user_id))
        conn.commit()
        
        # Güncellenmiş güncel kullanıcı verilerini geri dönelim (Frontend localStorage'ı tazelemek için)
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        updated_user = cursor.fetchone()
        conn.close()
        
        return {
            "status": "success",
            "message": "Profil başarıyla güncellendi.",
            "user": {
                "id": updated_user["id"],
                "email": updated_user["email"],
                "display_name": updated_user["display_name"],
                "role": updated_user["role"],
                "bio": updated_user["bio"],
                "custom_link": updated_user["custom_link"],
                "badge": updated_user["badge"],
                "profile_image": updated_user["profile_image"]
            }
        }
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Profil güncellenirken hata oluştu: {str(e)}")


# ----------------- FORUM SİSTEMİ ENDPOINTLERİ -----------------

@app.get("/api/forum/categories")
async def get_forum_categories():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM forum_categories")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/api/forum/categories/{category_id}/posts")
async def get_category_posts(category_id: int):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT fp.*, u.display_name, u.profile_image, u.badge FROM forum_posts fp
        JOIN users u ON fp.user_id = u.id
        WHERE fp.category_id = ?
        ORDER BY fp.tarih DESC
    """, (category_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/forum/posts")
async def create_forum_post(
    category_id: int = Form(...),
    user_id: int = Form(...),
    title: str = Form(...),
    content: str = Form(...),
    file: Optional[UploadFile] = File(None)
):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    image_url = None

    if file and file.filename:
        file_extension = os.path.splitext(file.filename)[1]
        custom_filename = f"post_{tempfile.mktemp().split(os.sep)[-1]}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, custom_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        image_url = f"http://localhost:8000/static/uploads/{custom_filename}"

    try:
        cursor.execute(
            "INSERT INTO forum_posts (category_id, user_id, title, content, image_url) VALUES (?, ?, ?, ?, ?)",
            (category_id, user_id, title, content, image_url)
        )
        post_id = cursor.lastrowid  
        
        cursor.execute(
            "INSERT INTO discover_feed (content_type, content_id) VALUES ('forum_post', ?)",
            (post_id,)
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Konu açılırken hata oluştu: {str(e)}")
    finally:
        conn.close()
    return {"status": "success", "message": "Konu başarıyla yayınlandı."}

@app.delete("/api/forum/posts/{post_id}")
async def delete_forum_post(post_id: int, user_id: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    cursor.execute("SELECT user_id FROM forum_posts WHERE id = ?", (post_id,))
    post = cursor.fetchone()
    
    if not post:
        conn.close()
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı.")
        
    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    
    if post[0] != user_id and (not user or user[0] != 'admin'):
        conn.close()
        raise HTTPException(status_code=403, detail="Bu gönderiyi silme yetkiniz yok.")
        
    try:
        cursor.execute("DELETE FROM forum_posts WHERE id = ?", (post_id,))
        cursor.execute("DELETE FROM discover_feed WHERE content_type = 'forum_post' AND content_id = ?", (post_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Silme işlemi başarısız: {str(e)}")
    finally:
        conn.close()
    return {"status": "success", "message": "Gönderi kaldırıldı."}

@app.get("/api/forum/posts/all")
async def get_all_posts():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT fp.*, u.display_name, u.profile_image, u.badge, c.name as category_name FROM forum_posts fp
        JOIN users u ON fp.user_id = u.id
        JOIN forum_categories c ON fp.category_id = c.id
        ORDER BY fp.tarih DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/forum/comments")
async def create_comment(comment: NewCommentModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO forum_comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)",
            (comment.post_id, comment.user_id, comment.content, comment.parent_id)
        )
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Yorum/Cevap eklenirken hata oluştu: {str(e)}")
    finally:
        conn.close()
    return {"status": "success", "message": "Yorum/Cevap başarıyla eklendi."}

@app.get("/api/forum/posts/{post_id}/comments")
async def get_post_comments(post_id: int):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT fc.*, u.display_name, u.profile_image, u.badge FROM forum_comments fc
        JOIN users u ON fc.user_id = u.id
        WHERE fc.post_id = ?
        ORDER BY fc.tarih ASC
    """, (post_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# Uye.js içinde kullanıcının kendi gönderilerini çekecek olan endpoint
@app.get("/api/user/{user_id}/posts")
async def get_user_posts(user_id: int):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT fp.*, c.name as category_name FROM forum_posts fp
        JOIN forum_categories c ON fp.category_id = c.id
        WHERE fp.user_id = ?
        ORDER BY fp.tarih DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/api/discover/feed")
async def get_discover_feed():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM discover_feed ORDER BY tarih DESC")
    feed_items = cursor.fetchall()
    aggregated_feed = []
    
    for item in feed_items:
        if item["content_type"] == "forum_post":
            cursor.execute("""
                SELECT fp.id, fp.title, fp.content, fp.tarih, u.display_name, 'forum_post' as type
                FROM forum_posts fp
                JOIN users u ON fp.user_id = u.id
                WHERE fp.id = ?
            """, (item["content_id"],))
            post_data = cursor.fetchone()
            if post_data:
                aggregated_feed.append(dict(post_data))
    conn.close()
    return aggregated_feed


# ----------------- ÜYELİK SİSTEMİ ENDPOINTLERİ -----------------

@app.post("/api/auth/register")
async def register_user(u: KayitModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        hashed_password = pwd_context.hash(u.password)
        cursor.execute(
            """INSERT INTO users (email, password_hash, display_name, auth_provider, role, badge) 
               VALUES (?, ?, ?, 'local', 'user', 'Maker')""",
            (u.email, hashed_password, u.display_name)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı!")
    finally:
        conn.close()
    return {"status": "success", "message": "Kayıt başarıyla tamamlandı!"}

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
            "role": user["role"],
            "bio": user["bio"],
            "custom_link": user["custom_link"],
            "badge": user["badge"],
            "profile_image": user["profile_image"]
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)