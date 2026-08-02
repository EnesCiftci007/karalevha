from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field
import sqlite3
import uvicorn
import os
import tempfile
import shutil
from typing import Optional, List
from passlib.context import CryptContext
from stl import mesh  # STL analizi için numpy-stl motoru

app = FastAPI(title="Karalevha Merkezi Backend Motoru v2.7.7")

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

DB_NAME = "karalevha.db"
UPLOAD_DIR = "static/uploads"
LIBRARY_DIR = "static/library"  # Kütüphane dosyalarının saklanacağı ana dizin

# Klasörleri otomatik oluşturuyoruz
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(LIBRARY_DIR, exist_ok=True)

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
            eposta TEXT NULL,
            adres TEXT,
            teslimat_yontemi TEXT NOT NULL,
            toplam_fiyat REAL NOT NULL,
            sepet_icerigi TEXT NOT NULL,
            durum TEXT DEFAULT 'Sipariş Alındı',
            iletisim_tercihi TEXT DEFAULT 'WhatsApp',
            [not] TEXT NULL, 
            tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 8. E-Kütüphane Klasörler Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS library_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            parent_id INTEGER NULL,
            user_id INTEGER NOT NULL DEFAULT 1,
            is_private INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(parent_id) REFERENCES library_folders(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # 9. E-Kütüphane Dosyalar Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS library_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_id INTEGER NULL,
            user_id INTEGER NOT NULL,
            display_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size REAL NOT NULL, 
            tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(folder_id) REFERENCES library_folders(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # 10. E-Kütüphane Gizli Klasör Beyaz Liste İzin Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS library_folder_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            FOREIGN KEY(folder_id) REFERENCES library_folders(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(folder_id, user_id)
        )
    ''')
    
    # Geçiş Güvenliği (Migrations)
    try:
        cursor.execute("ALTER TABLE print_orders ADD COLUMN eposta TEXT NULL")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE print_orders ADD COLUMN iletisim_tercihi TEXT DEFAULT 'WhatsApp'")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE print_orders ADD COLUMN [not] TEXT NULL")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE library_folders ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE library_folders ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    
    cursor.execute("SELECT COUNT(*) FROM forum_categories")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO forum_categories (name, description) VALUES ('3D Baskı Hizmeti ve Sorular', 'Siparişler ve baskı kalitesi hakkında sorularınız')")
        cursor.execute("INSERT INTO forum_categories (name, description) VALUES ('Donanım ve Maker Dünyası', 'Elektronik, filamentler ve yazıcı modifikasyonları')")

    conn.commit()
    conn.close()

veritabani_hazirla()


# ----------------- PYDANTIC MODELLERİ -----------------

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
    eposta: str  
    adres: Optional[str] = None
    teslimat_yontemi: str
    toplam_fiyat: float
    sepet_icerigi: str
    iletisim_tercihi: str  
    not_alani: Optional[str] = Field(default=None, alias="not")  

    model_config = {
        "populate_by_name": True
    }

class SiparisDurumModel(BaseModel):
    durum: str

# E-Kütüphane Modelleri
class FolderCreateModel(BaseModel):
    name: str
    parent_id: Optional[int] = None
    user_id: int
    is_private: Optional[int] = 0

class ItemRenameModel(BaseModel):
    name: str
    user_id: int
    is_private: Optional[int] = 0 

class ItemMoveModel(BaseModel):
    parent_id: Optional[int] = None  
    user_id: int

class WhitelistEmailModel(BaseModel):
    email: EmailStr


# ----------------- ADMİN PANEL ENTEGRASYONLARI -----------------

@app.get("/api/admin/stats")
async def get_admin_stats():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        kullanici_sayisi = cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        conu_sayisi = cursor.execute("SELECT COUNT(*) FROM forum_posts").fetchone()[0]
        baski_sayisi = cursor.execute("SELECT COUNT(*) FROM print_orders WHERE durum NOT IN ('Teslim Edildi', 'İptal Edildi')").fetchone()[0]
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"İstatistikler okunamadı: {str(e)}")
    conn.close()
    return {
        "kullaniciSayisi": kullanici_sayisi,
        "konuSayisi": conu_sayisi,
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
        orders = cursor.execute("SELECT id, user_id, isim, telefon, eposta, adres, teslimat_yontemi, toplam_fiyat, sepet_icerigi, durum, iletisim_tercihi, tarih, [not] FROM print_orders ORDER BY tarih DESC").fetchall()
        
        result = []
        for row in orders:
            d = dict(row)
            d["uretim_notu"] = row["not"] if "not" in row.keys() else None
            result.append(d)
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sipariş listesi alınamadı: {str(e)}")
    finally:
        conn.close()

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
    return {"status": "success", "message": "Sipariş durumu veritabanında güncellendi!"}


# ----------------- MÜŞTERİ SİPARİŞ ENDPOINT'İ -----------------

@app.post("/api/orders")
async def create_order(order: SiparisModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute(
            """INSERT INTO print_orders (user_id, isim, telefon, eposta, adres, teslimat_yontemi, toplam_fiyat, sepet_icerigi, iletisim_tercihi, [not]) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (order.user_id, order.isim, order.telefon, order.eposta, order.adres, order.teslimat_yontemi, order.toplam_fiyat, order.sepet_icerigi, order.iletisim_tercihi, order.not_alani)
        )
        conn.commit()
        return {"status": "success", "message": "Sipariş matrisi başarıyla işlendi"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Sipariş hatası: {str(e)}")
    finally:
        conn.close()


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

        # Göreceli Yol (Relative URL) - İster local ister sunucu, sorunsuz çalışır
        saved_file_url = f"/static/uploads/{custom_filename}"

        return {
            "status": "success",
            "volume": float(volume),             
            "dimensions": dimensions_str,
            "fileUrl": saved_file_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STL analiz hatası: {str(e)}")


# ----------------- E-KÜTÜPHANE MODÜLÜ ENDPOINTLERİ -----------------

@app.post("/api/library/folders")
async def create_folder(folder: FolderCreateModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        p_id = folder.parent_id if (folder.parent_id != 0 and folder.parent_id != "0") else None
        cursor.execute(
            "INSERT INTO library_folders (name, parent_id, user_id, is_private) VALUES (?, ?, ?, ?)",
            (folder.name.strip(), p_id, folder.user_id, folder.is_private)
        )
        conn.commit()
        folder_id = cursor.lastrowid
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Klasör oluşturulamadı: {str(e)}")
    finally:
        conn.close()
    return {"status": "success", "folder_id": folder_id}


@app.post("/api/library/files")
async def upload_library_file(folder_id: int = Form(...), user_id: int = Form(...), file: UploadFile = File(...)):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"lib_{tempfile.mktemp().split(os.sep)[-1]}{file_extension}"
        physical_path = os.path.join(LIBRARY_DIR, unique_filename)
        
        with open(physical_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        file_size_mb = round(os.path.getsize(physical_path) / (1024 * 1024), 2)
        # Göreceli Yol (Relative URL)
        file_url = f"/static/library/{unique_filename}"
        
        target_folder = folder_id if (folder_id != 0 and folder_id != "0") else None
        
        cursor.execute(
            "INSERT INTO library_files (folder_id, user_id, display_name, file_path, file_size) VALUES (?, ?, ?, ?, ?)",
            (target_folder, user_id, file.filename, file_url, file_size_mb)
        )
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Dosya kütüphaneye kaydedilemedi: {str(e)}")
    finally:
        conn.close()


@app.get("/api/library/contents")
async def get_library_contents(parent_id: Optional[str] = None, current_user_id: Optional[str] = None):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        user_role = "user"
        
        try:
            if current_user_id and str(current_user_id).strip() != "":
                c_user_id = int(current_user_id)
            else:
                c_user_id = None
        except:
            c_user_id = None

        try:
            if parent_id is not None and str(parent_id).strip() != "" and str(parent_id) != "0":
                p_id = int(parent_id)
            else:
                p_id = None
        except:
            p_id = None
                
        if c_user_id:
            u_rec = cursor.execute("SELECT role FROM users WHERE id = ?", (c_user_id,)).fetchone()
            if u_rec:
                user_role = u_rec["role"]

        if p_id is None:
            folders_raw = cursor.execute("SELECT * FROM library_folders WHERE parent_id IS NULL ORDER BY name ASC").fetchall()
            files_raw = cursor.execute("SELECT lf.*, u.display_name as uploader FROM library_files lf JOIN users u ON lf.user_id = u.id WHERE lf.folder_id IS NULL ORDER BY lf.tarih DESC").fetchall()
        else:
            folders_raw = cursor.execute("SELECT * FROM library_folders WHERE parent_id = ? ORDER BY name ASC", (p_id,)).fetchall()
            files_raw = cursor.execute("SELECT lf.*, u.display_name as uploader FROM library_files lf JOIN users u ON lf.user_id = u.id WHERE lf.folder_id = ? ORDER BY lf.tarih DESC", (p_id,)).fetchall()

        filtered_folders = []
        for folder in folders_raw:
            f_dict = dict(folder)
            if f_dict.get("is_private") == 0:
                filtered_folders.append(f_dict)
            else:
                if c_user_id is not None:
                    has_whitelist_perm = cursor.execute(
                        "SELECT 1 FROM library_folder_permissions WHERE folder_id = ? AND user_id = ?", 
                        (f_dict["id"], c_user_id)
                    ).fetchone()
                    if f_dict["user_id"] == c_user_id or user_role == "admin" or has_whitelist_perm:
                        filtered_folders.append(f_dict)

        breadcrumbs = []
        current_id = p_id
        visited = set()
        while current_id is not None and current_id not in visited:
            visited.add(current_id)
            folder_info = cursor.execute("SELECT id, name, parent_id FROM library_folders WHERE id = ?", (current_id,)).fetchone()
            if folder_info:
                breadcrumbs.insert(0, {"id": int(folder_info["id"]), "name": str(folder_info["name"])})
                current_id = folder_info["parent_id"]
            else:
                break

        return {
            "status": "success",
            "folders": filtered_folders,
            "files": [dict(r) for r in files_raw],
            "breadcrumbs": breadcrumbs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/library/files/{file_id}")
async def delete_library_file(file_id: int, user_id: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        file_record = cursor.execute("SELECT user_id, file_path FROM library_files WHERE id = ?", (file_id,)).fetchone()
        if not file_record:
            raise HTTPException(status_code=404, detail="Dosya bulunamadı.")
        
        uploader_id, file_url = file_record[0], file_record[1]
        user_record = cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        user_role = user_record[0] if user_record else "user"
        
        if uploader_id != user_id and user_role != "admin":
            raise HTTPException(status_code=403, detail="Bu dosyayı silmeye yetkiniz bulunmamaktadır.")
        
        filename = file_url.split("/")[-1]
        physical_path = os.path.join(LIBRARY_DIR, filename)
        if os.path.exists(physical_path):
            os.remove(physical_path)
            
        cursor.execute("DELETE FROM library_files WHERE id = ?", (file_id,))
        conn.commit()
        return {"status": "success", "message": "Dosya kütüphaneden kalıcı olarak silindi."}
    finally:
        conn.close()


@app.delete("/api/library/folders/{folder_id}")
async def delete_library_folder(folder_id: int, user_id: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        folder_record = cursor.execute("SELECT user_id FROM library_folders WHERE id = ?", (folder_id,)).fetchone()
        if not folder_record:
            raise HTTPException(status_code=404, detail="Klasör bulunamadı.")
        
        uploader_id = folder_record[0]
        user_record = cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        user_role = user_record[0] if user_record else "user"
        
        if uploader_id != user_id and user_role != "admin":
            raise HTTPException(status_code=403, detail="Bu klasörü silmeye yetkiniz bulunmamaktadır.")
            
        cursor.execute("DELETE FROM library_folders WHERE id = ?", (folder_id,))
        conn.commit()
        return {"status": "success", "message": "Klasör ve tüm alt içerikleri başarıyla temizlendi."}
    finally:
        conn.close()


@app.put("/api/library/folders/{folder_id}/update")
async def update_folder(folder_id: int, req: ItemRenameModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        folder_record = cursor.execute("SELECT user_id FROM library_folders WHERE id = ?", (folder_id,)).fetchone()
        if not folder_record:
            raise HTTPException(status_code=404, detail="Klasör bulunamadı.")
            
        uploader_id = folder_record[0]
        user_record = cursor.execute("SELECT role FROM users WHERE id = ?", (req.user_id,)).fetchone()
        user_role = user_record[0] if user_record else "user"
        
        if uploader_id != req.user_id and user_role != "admin":
            raise HTTPException(status_code=403, detail="Bu klasörün ayarlarını değiştirmeye yetkiniz bulunmamaktadır.")

        cursor.execute(
            "UPDATE library_folders SET name = ?, is_private = ? WHERE id = ?", 
            (req.name.strip(), req.is_private, folder_id)
        )
        conn.commit()
        return {"status": "success", "message": "Klasör başarıyla güncellendi."}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.put("/api/library/files/{file_id}/rename")
async def rename_file(file_id: int, req: ItemRenameModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        file_record = cursor.execute("SELECT user_id FROM library_files WHERE id = ?", (file_id,)).fetchone()
        if not file_record:
            raise HTTPException(status_code=404, detail="Dosya bulunamadı.")
            
        uploader_id = file_record[0]
        user_record = cursor.execute("SELECT role FROM users WHERE id = ?", (req.user_id,)).fetchone()
        user_role = user_record[0] if user_record else "user"
        
        if uploader_id != req.user_id and user_role != "admin":
            raise HTTPException(status_code=403, detail="Bu dosyanın adını değiştirmeye yetkiniz bulunmamaktadır.")

        cursor.execute("UPDATE library_files SET display_name = ? WHERE id = ?", (req.name.strip(), file_id))
        conn.commit()
        return {"status": "success", "message": "Dosya adı güncellendi."}
    finally:
        conn.close()


@app.put("/api/library/folders/{folder_id}/move")
async def move_folder(folder_id: int, req: ItemMoveModel):
    if req.parent_id == folder_id:
        raise HTTPException(status_code=400, detail="Bir klasörü kendi içine taşıyamazsınız.")
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        folder_record = cursor.execute("SELECT user_id FROM library_folders WHERE id = ?", (folder_id,)).fetchone()
        if not folder_record:
            raise HTTPException(status_code=404, detail="Klasör bulunamadı.")
            
        uploader_id = folder_record[0]
        user_record = cursor.execute("SELECT role FROM users WHERE id = ?", (req.user_id,)).fetchone()
        user_role = user_record[0] if user_record else "user"
        
        if uploader_id != req.user_id and user_role != "admin":
            raise HTTPException(status_code=403, detail="Bu klasörü taşımaya yetkiniz bulunmamaktadır.")

        target_parent = req.parent_id if (req.parent_id != 0 and req.parent_id != "0") else None
        cursor.execute("UPDATE library_folders SET parent_id = ? WHERE id = ?", (target_parent, folder_id))
        conn.commit()
        return {"status": "success", "message": "Klasör başarıyla taşındı."}
    finally:
        conn.close()


@app.put("/api/library/files/{file_id}/move")
async def move_file(file_id: int, req: ItemMoveModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        file_record = cursor.execute("SELECT user_id FROM library_files WHERE id = ?", (file_id,)).fetchone()
        if not file_record:
            raise HTTPException(status_code=404, detail="Dosya bulunamadı.")
            
        uploader_id = file_record[0]
        user_record = cursor.execute("SELECT role FROM users WHERE id = ?", (req.user_id,)).fetchone()
        user_role = user_record[0] if user_record else "user"
        
        if uploader_id != req.user_id and user_role != "admin":
            raise HTTPException(status_code=403, detail="Bu dosyayı taşımaya yetkiniz bulunmamaktadır.")

        target_folder = req.parent_id if (req.parent_id != 0 and req.parent_id != "0") else None
        cursor.execute("UPDATE library_files SET folder_id = ? WHERE id = ?", (target_folder, file_id))
        conn.commit()
        return {"status": "success", "message": "Dosya başarıyla taşındı."}
    finally:
        conn.close()


@app.get("/api/library/folders/{folder_id}/permissions")
async def get_folder_permissions(folder_id: int):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        users = cursor.execute(
            """SELECT u.id, u.email, u.display_name FROM library_folder_permissions p 
               JOIN users u ON p.user_id = u.id WHERE p.folder_id = ?""", (folder_id,)
        ).fetchall()
        return {"status": "success", "users": [dict(r) for r in users]}
    finally:
        conn.close()


@app.post("/api/library/folders/{folder_id}/permissions")
async def add_folder_permission(folder_id: int, req: WhitelistEmailModel):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        user = cursor.execute("SELECT id FROM users WHERE email = ?", (req.email.strip(),)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Bu e-posta adresine ait bir kullanıcı bulunamadı.")
        
        user_id = user[0]
        cursor.execute(
            "INSERT OR IGNORE INTO library_folder_permissions (folder_id, user_id) VALUES (?, ?)",
            (folder_id, user_id)
        )
        conn.commit()
        return {"status": "success", "message": "Kullanıcı beyaz listeye eklendi."}
    finally:
        conn.close()


@app.delete("/api/library/folders/{folder_id}/permissions/{user_id}")
async def remove_folder_permission(folder_id: int, user_id: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM library_folder_permissions WHERE folder_id = ? AND user_id = ?", (folder_id, user_id))
        conn.commit()
        return {"status": "success", "message": "Kullanıcının erişim izni kaldırıldı."}
    finally:
        conn.close()


# ----------------- FORUM SİSTEMİ VE PROFİL ENDPOINTLERİ -----------------

@app.put("/api/user/profile")
async def update_user_profile(user_id: int = Form(...), display_name: str = Form(...), bio: Optional[str] = Form(None), custom_link: Optional[str] = Form(None), file: Optional[UploadFile] = File(None)):
    conn = sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row; cursor = conn.cursor()
    user = cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user: conn.close(); raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    profile_image_url = user["profile_image"]
    if file and file.filename:
        fe = os.path.splitext(file.filename)[1]; cf = f"avatar_{user_id}_{tempfile.mktemp().split(os.sep)[-1]}{fe}"; fp = os.path.join(UPLOAD_DIR, cf)
        with open(fp, "wb") as b: shutil.copyfileobj(file.file, b)
        # Göreceli Yol
        profile_image_url = f"/static/uploads/{cf}"
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
        # Göreceli Yol
        img = f"/static/uploads/{cf}"
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
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    fi = cursor.execute("SELECT * FROM discover_feed ORDER BY tarih DESC").fetchall()
    agg = []
    for item in fi:
        if item["content_type"] == "forum_post":
            p = cursor.execute("SELECT fp.id, fp.title, fp.content, fp.tarih, u.display_name, 'forum_post' as type FROM forum_posts fp JOIN users u ON fp.user_id = u.id WHERE fp.id = ?", (item["content_id"],)).fetchone()
            if p: agg.append(dict(p))
    conn.close()
    return agg

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
    # Dış ağ dinlemesi "0.0.0.0" olarak yapıldı
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)