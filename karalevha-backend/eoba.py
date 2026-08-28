from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import sqlite3
import json
import secrets
from datetime import datetime, timedelta

eoba_router = APIRouter(prefix="/api/eoba", tags=["E-Oba"])
DB_NAME = "karalevha.db"

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

# ----------------- VERİTABANI İLKLEME -----------------

def eoba_veritabani_hazirla():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Obalar
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS obalar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            avatar_url TEXT DEFAULT NULL,
            banner_url TEXT DEFAULT NULL,
            owner_id INTEGER NOT NULL,
            is_public INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # 13. Oba Davetleri (Davet Linkleri ve Kodları)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS oba_invites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            oba_id INTEGER NOT NULL,
            code TEXT UNIQUE NOT NULL,
            created_by INTEGER NOT NULL,
            max_uses INTEGER DEFAULT NULL,
            uses_count INTEGER DEFAULT 0,
            expires_at TIMESTAMP DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(oba_id) REFERENCES obalar(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_oba_invites_code ON oba_invites(code)")

    # 2. Oba Rolleri (Discord tarzı Tag & Yetki)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS oba_roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            oba_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#0066ff',
            position INTEGER DEFAULT 0,
            is_default INTEGER DEFAULT 0,
            permissions TEXT DEFAULT '[]',
            FOREIGN KEY(oba_id) REFERENCES obalar(id) ON DELETE CASCADE
        )
    ''')

    # 3. Oba Üyeleri
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS oba_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            oba_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            nickname TEXT DEFAULT NULL,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(oba_id) REFERENCES obalar(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(oba_id, user_id)
        )
    ''')

    # 4. Üye - Rol Eşleşmesi
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS oba_member_roles (
            oba_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role_id INTEGER NOT NULL,
            PRIMARY KEY(oba_id, user_id, role_id),
            FOREIGN KEY(oba_id) REFERENCES obalar(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(role_id) REFERENCES oba_roles(id) ON DELETE CASCADE
        )
    ''')

    # 5. Çadırlar (Kategori)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cadirlar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            oba_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            order_index INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(oba_id) REFERENCES obalar(id) ON DELETE CASCADE
        )
    ''')

    # 6. Masalar (Alt Kategori / Çalışma Odası)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS masalar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cadir_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            icon TEXT DEFAULT '🪑',
            order_index INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(cadir_id) REFERENCES cadirlar(id) ON DELETE CASCADE
        )
    ''')

    # 7. Levhalar (Modüler Fonksiyon Birimi: Chat, Duyuru, Tablo, Kanban)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS levhalar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            masa_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            icon TEXT DEFAULT NULL,
            config_json TEXT DEFAULT '{}',
            order_index INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(masa_id) REFERENCES masalar(id) ON DELETE CASCADE
        )
    ''')

    # 8. Kademeli Yetki Ezme / Override (Çadır, Masa veya Levha seviyesinde)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS permission_overrides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_type TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            role_id INTEGER NOT NULL,
            allow_perms TEXT DEFAULT '[]',
            deny_perms TEXT DEFAULT '[]',
            FOREIGN KEY(role_id) REFERENCES oba_roles(id) ON DELETE CASCADE,
            UNIQUE(target_type, target_id, role_id)
        )
    ''')

    # 9. Levha - Chat Mesajları
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS levha_chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            levha_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            file_url TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(levha_id) REFERENCES levhalar(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # 10. Levha - Duyurular
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS levha_announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            levha_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            is_pinned INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(levha_id) REFERENCES levhalar(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # 11. Levha - Tablo (Excel / BOM) Satırları
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS levha_table_rows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            levha_id INTEGER NOT NULL,
            row_data TEXT NOT NULL,
            order_index INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(levha_id) REFERENCES levhalar(id) ON DELETE CASCADE
        )
    ''')

    # 12. Levha - Görev Takip (Kanban) Kartları
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS levha_kanban_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            levha_id INTEGER NOT NULL,
            column_name TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT NULL,
            assigned_user_id INTEGER DEFAULT NULL,
            tag TEXT DEFAULT NULL,
            order_index INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(levha_id) REFERENCES levhalar(id) ON DELETE CASCADE
        )
    ''')

    # Varsayılan başlangıç obası kontrolü
    cursor.execute("SELECT COUNT(*) FROM obalar")
    if cursor.fetchone()[0] == 0:
        first_user = cursor.execute("SELECT id FROM users ORDER BY id ASC LIMIT 1").fetchone()
        owner_id = first_user[0] if first_user else 1

        cursor.execute('''
            INSERT INTO obalar (name, description, avatar_url, owner_id, is_public)
            VALUES (?, ?, ?, ?, 1)
        ''', (
            "KaraLevha Ana Atölyesi",
            "Makerların, 3D baskı meraklılarının ve açık kaynak geliştiricilerin resmi ortak çalışma obası.",
            "https://api.dicebear.com/7.x/bottts/svg?seed=karalevha",
            owner_id
        ))
        oba_id = cursor.lastrowid

        # Oba rollerini ekle
        all_perms = json.dumps(["admin", "view", "write", "manage_content", "manage_structure", "manage_roles", "manage_members"])
        maker_perms = json.dumps(["view", "write"])
        default_perms = json.dumps(["view", "write"])

        cursor.execute("INSERT INTO oba_roles (oba_id, name, color, position, permissions) VALUES (?, ?, ?, ?, ?)",
                       (oba_id, "Oba Beyi 👑", "#ef4444", 100, all_perms))
        admin_role_id = cursor.lastrowid

        cursor.execute("INSERT INTO oba_roles (oba_id, name, color, position, permissions) VALUES (?, ?, ?, ?, ?)",
                       (oba_id, "Baş Mühendis 🛠️", "#0066ff", 50, all_perms))

        cursor.execute("INSERT INTO oba_roles (oba_id, name, color, position, permissions) VALUES (?, ?, ?, ?, ?)",
                       (oba_id, "Maker 🖨️", "#10b981", 10, maker_perms))

        cursor.execute("INSERT INTO oba_roles (oba_id, name, color, position, is_default, permissions) VALUES (?, ?, ?, ?, 1, ?)",
                       (oba_id, "@herkes", "#94a3b8", 0, default_perms))

        # Kurucuyu üye yap ve Oba Beyi rolü ata
        cursor.execute("INSERT OR IGNORE INTO oba_members (oba_id, user_id) VALUES (?, ?)", (oba_id, owner_id))
        cursor.execute("INSERT OR IGNORE INTO oba_member_roles (oba_id, user_id, role_id) VALUES (?, ?, ?)", (oba_id, owner_id, admin_role_id))

        # Çadır 1: 3B Baskı & Tasarım
        cursor.execute("INSERT INTO cadirlar (oba_id, name, order_index) VALUES (?, ?, ?)",
                       (oba_id, "3B Baskı ve Proje Odaları", 1))
        cadir1_id = cursor.lastrowid

        # Masa 1: Voron & Klipper Geliştirme Masası
        cursor.execute("INSERT INTO masalar (cadir_id, name, icon, order_index) VALUES (?, ?, ?, ?)",
                       (cadir1_id, "Voron 2.4 Revizyonu", "🖨️", 1))
        masa1_id = cursor.lastrowid

        # Levhalar:
        # 1. Chat
        cursor.execute("INSERT INTO levhalar (masa_id, title, type, icon, order_index) VALUES (?, ?, 'chat', '💬', 1)",
                       (masa1_id, "Masa Sohbeti"))
        # 2. Duyuru
        cursor.execute("INSERT INTO levhalar (masa_id, title, type, icon, order_index) VALUES (?, ?, 'duyuru', '📢', 2)",
                       (masa1_id, "Önemli Duyurular"))
        # 3. Tablo (Excel / BOM)
        table_config = json.dumps({"columns": ["Parça Adı", "Miktar", "Birim Fiyat (TL)", "Tedarikçi", "Durum"]})
        cursor.execute("INSERT INTO levhalar (masa_id, title, type, icon, config_json, order_index) VALUES (?, ?, 'tablo', '📊', ?, 3)",
                       (masa1_id, "BOM & Malzeme Tablosu", table_config))
        table_levha_id = cursor.lastrowid

        # Örnek Tablo Satırları
        r1 = json.dumps({"Parça Adı": "MGN12H Lineer Ray (350mm)", "Miktar": "4", "Birim Fiyat (TL)": "320", "Tedarikçi": "MakerDepo", "Durum": "Teslim Alındı"})
        r2 = json.dumps({"Parça Adı": "NEMA 17 Step Motor (0.9 derece)", "Miktar": "7", "Birim Fiyat (TL)": "280", "Tedarikçi": "Robotistan", "Durum": "Kargoda"})
        r3 = json.dumps({"Parça Adı": "Dragon HF Hotend", "Miktar": "1", "Birim Fiyat (TL)": "1450", "Tedarikçi": "AliExpress", "Durum": "Sipariş Verildi"})
        cursor.execute("INSERT INTO levha_table_rows (levha_id, row_data, order_index) VALUES (?, ?, 1)", (table_levha_id, r1))
        cursor.execute("INSERT INTO levha_table_rows (levha_id, row_data, order_index) VALUES (?, ?, 2)", (table_levha_id, r2))
        cursor.execute("INSERT INTO levha_table_rows (levha_id, row_data, order_index) VALUES (?, ?, 3)", (table_levha_id, r3))

        # 4. Kanban (Görev Levhası)
        kanban_config = json.dumps({"columns": ["Fikir / Tasarım", "Baskıda / Üretimde", "Montaj & Test", "Tamamlandı"]})
        cursor.execute("INSERT INTO levhalar (masa_id, title, type, icon, config_json, order_index) VALUES (?, ?, 'kanban', '📌', ?, 4)",
                       (masa1_id, "İş Takip Panosu", kanban_config))
        kanban_levha_id = cursor.lastrowid

        # Örnek Görevler
        cursor.execute("INSERT INTO levha_kanban_cards (levha_id, column_name, title, description, tag) VALUES (?, ?, ?, ?, ?)",
                       (kanban_levha_id, "Fikir / Tasarım", "Gantry Parçalarının Dilimlenmesi", "ABS/ASA malzeme ile %40 infill basılacak.", "Tasarım"))
        cursor.execute("INSERT INTO levha_kanban_cards (levha_id, column_name, title, description, tag) VALUES (?, ?, ?, ?, ?)",
                       (kanban_levha_id, "Baskıda / Üretimde", "Z-Joint Parçaları Baskısı", "Voron siyah filament kullanılıyor.", "Baskı"))
        cursor.execute("INSERT INTO levha_kanban_cards (levha_id, column_name, title, description, tag) VALUES (?, ?, ?, ?, ?)",
                       (kanban_levha_id, "Montaj & Test", "Klipper Config Dosyası Hazırlığı", "TMC2209 akım ayarları test edilecek.", "Yazılım"))
        cursor.execute("INSERT INTO levha_kanban_cards (levha_id, column_name, title, description, tag) VALUES (?, ?, ?, ?, ?)",
                       (kanban_levha_id, "Tamamlandı", "Alüminyum Şasi İskelet Kurulumu", "Karelik ve gönye testleri başarıyla geçti.", "Mekanik"))

    conn.commit()
    conn.close()

# ----------------- PYDANTIC MODELLERİ -----------------

class ObaCreateModel(BaseModel):
    name: str
    description: Optional[str] = ""
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    is_public: Optional[int] = 1
    user_id: int

class ObaUpdateModel(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    is_public: Optional[int] = None
    user_id: int

class RoleCreateModel(BaseModel):
    name: str
    color: Optional[str] = "#0066ff"
    position: Optional[int] = 0
    permissions: Optional[List[str]] = ["view", "write"]
    user_id: int

class RoleUpdateModel(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    position: Optional[int] = None
    permissions: Optional[List[str]] = None
    user_id: int

class MemberRolesUpdateModel(BaseModel):
    role_ids: List[int]
    user_id: int

class CadirCreateModel(BaseModel):
    oba_id: int
    name: str
    order_index: Optional[int] = 0
    user_id: int

class MasaCreateModel(BaseModel):
    cadir_id: int
    name: str
    icon: Optional[str] = "🪑"
    order_index: Optional[int] = 0
    user_id: int

class LevhaCreateModel(BaseModel):
    masa_id: int
    title: str
    type: str  # 'chat', 'duyuru', 'tablo', 'kanban'
    icon: Optional[str] = None
    config_json: Optional[Dict[str, Any]] = None
    order_index: Optional[int] = 0
    user_id: int

class PermissionOverrideModel(BaseModel):
    target_type: str  # 'cadir', 'masa', 'levha'
    target_id: int
    role_id: int
    allow_perms: List[str]
    deny_perms: List[str]
    user_id: int

class ItemRenameModel(BaseModel):
    name: str
    user_id: int

class InviteCreateModel(BaseModel):
    user_id: int
    max_uses: Optional[int] = None
    expires_days: Optional[int] = None

class InviteUseModel(BaseModel):
    code: str
    user_id: int

class DirectInviteModel(BaseModel):
    sender_id: int
    target_username: str

class ChatMessageModel(BaseModel):
    levha_id: int
    user_id: int
    content: str
    file_url: Optional[str] = None

class AnnouncementModel(BaseModel):
    levha_id: int
    user_id: int
    title: str
    content: str
    is_pinned: Optional[int] = 0

class TableConfigModel(BaseModel):
    columns: List[str]
    user_id: int

class TableRowModel(BaseModel):
    row_data: Dict[str, Any]
    user_id: int

class KanbanCardModel(BaseModel):
    levha_id: int
    column_name: str
    title: str
    description: Optional[str] = None
    tag: Optional[str] = None
    assigned_user_id: Optional[int] = None
    user_id: int

class KanbanCardUpdateModel(BaseModel):
    column_name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    tag: Optional[str] = None
    assigned_user_id: Optional[int] = None
    user_id: int


# ----------------- YETKİ KONTROL MOTORU (DISCORD MİMARİSİ) -----------------

def get_user_oba_permissions(cursor, oba_id: int, user_id: Optional[int], target_type: Optional[str] = None, target_id: Optional[int] = None) -> Dict[str, bool]:
    perms = {
        "admin": False,
        "view": True,
        "write": False,
        "manage_content": False,
        "manage_structure": False,
        "manage_roles": False,
        "manage_members": False
    }

    if not user_id:
        return perms

    u = cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
    if u and u["role"] == "admin":
        return {k: True for k in perms}

    oba = cursor.execute("SELECT owner_id, is_public FROM obalar WHERE id = ?", (oba_id,)).fetchone()
    if not oba:
        return perms

    if oba["owner_id"] == user_id:
        return {k: True for k in perms}

    roles = cursor.execute('''
        SELECT r.* FROM oba_roles r
        JOIN oba_member_roles mr ON r.id = mr.role_id
        WHERE mr.oba_id = ? AND mr.user_id = ?
        UNION
        SELECT * FROM oba_roles WHERE oba_id = ? AND is_default = 1
    ''', (oba_id, user_id, oba_id)).fetchall()

    user_role_ids = [r["id"] for r in roles]

    for r in roles:
        role_perms = json.loads(r["permissions"]) if r["permissions"] else []
        for p in role_perms:
            if p in perms:
                perms[p] = True
            if p == "admin":
                return {k: True for k in perms}

    if target_type and target_id and user_role_ids:
        targets = []
        if target_type == "levha":
            levha = cursor.execute("SELECT id, masa_id FROM levhalar WHERE id = ?", (target_id,)).fetchone()
            if levha:
                masa = cursor.execute("SELECT id, cadir_id FROM masalar WHERE id = ?", (levha["masa_id"],)).fetchone()
                if masa:
                    targets.append(("cadir", masa["cadir_id"]))
                targets.append(("masa", levha["masa_id"]))
            targets.append(("levha", target_id))
        elif target_type == "masa":
            masa = cursor.execute("SELECT id, cadir_id FROM masalar WHERE id = ?", (target_id,)).fetchone()
            if masa:
                targets.append(("cadir", masa["cadir_id"]))
            targets.append(("masa", target_id))
        elif target_type == "cadir":
            targets.append(("cadir", target_id))

        for t_type, t_id in targets:
            placeholders = ",".join("?" for _ in user_role_ids)
            overrides = cursor.execute(f'''
                SELECT * FROM permission_overrides
                WHERE target_type = ? AND target_id = ? AND role_id IN ({placeholders})
            ''', (t_type, t_id, *user_role_ids)).fetchall()

            for ov in overrides:
                allow = json.loads(ov["allow_perms"]) if ov["allow_perms"] else []
                deny = json.loads(ov["deny_perms"]) if ov["deny_perms"] else []

                for d in deny:
                    if d in perms:
                        perms[d] = False
                for a in allow:
                    if a in perms:
                        perms[a] = True

    return perms


# ----------------- ENDPOINT'LER: OBA YÖNETİMİ -----------------

@eoba_router.get("/obalar")
def get_obalar(user_id: Optional[int] = Query(None)):
    conn = get_db()
    cursor = conn.cursor()

    rows = cursor.execute('''
        SELECT o.*, u.display_name as owner_name, u.badge as owner_badge,
               (SELECT COUNT(*) FROM oba_members WHERE oba_id = o.id) as member_count
        FROM obalar o
        JOIN users u ON o.owner_id = u.id
        ORDER BY o.created_at DESC
    ''').fetchall()

    result = []
    for r in rows:
        d = dict(r)
        d["is_member"] = False
        d["is_owner"] = (user_id is not None and d["owner_id"] == user_id)
        if user_id:
            m = cursor.execute("SELECT 1 FROM oba_members WHERE oba_id = ? AND user_id = ?", (d["id"], user_id)).fetchone()
            if m:
                d["is_member"] = True
        result.append(d)

    conn.close()
    return result


@eoba_router.post("/obalar")
def create_oba(payload: ObaCreateModel):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO obalar (name, description, avatar_url, banner_url, owner_id, is_public)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (payload.name, payload.description, payload.avatar_url, payload.banner_url, payload.user_id, payload.is_public))
    oba_id = cursor.lastrowid

    all_perms = json.dumps(["admin", "view", "write", "manage_content", "manage_structure", "manage_roles", "manage_members"])
    cursor.execute('''
        INSERT INTO oba_roles (oba_id, name, color, position, permissions)
        VALUES (?, 'Oba Beyi 👑', '#ef4444', 100, ?)
    ''', (oba_id, all_perms))
    admin_role_id = cursor.lastrowid

    default_perms = json.dumps(["view", "write"])
    cursor.execute('''
        INSERT INTO oba_roles (oba_id, name, color, position, is_default, permissions)
        VALUES (?, '@herkes', '#94a3b8', 0, 1, ?)
    ''', (oba_id, default_perms))

    cursor.execute("INSERT INTO oba_members (oba_id, user_id) VALUES (?, ?)", (oba_id, payload.user_id))
    cursor.execute("INSERT INTO oba_member_roles (oba_id, user_id, role_id) VALUES (?, ?, ?)", (oba_id, payload.user_id, admin_role_id))

    cursor.execute("INSERT INTO cadirlar (oba_id, name, order_index) VALUES (?, 'Genel Meydan', 1)", (oba_id,))
    cadir_id = cursor.lastrowid

    cursor.execute("INSERT INTO masalar (cadir_id, name, icon, order_index) VALUES (?, 'Ana Çalışma Masası', '🪑', 1)", (cadir_id,))
    masa_id = cursor.lastrowid

    cursor.execute("INSERT INTO levhalar (masa_id, title, type, icon, order_index) VALUES (?, 'Sohbet', 'chat', '💬', 1)", (masa_id,))
    cursor.execute("INSERT INTO levhalar (masa_id, title, type, icon, order_index) VALUES (?, 'Duyurular', 'duyuru', '📢', 2)", (masa_id,))
    
    t_cfg = json.dumps({"columns": ["Malzeme / Parça", "Miktar", "Birim Fiyat", "Durum"]})
    cursor.execute("INSERT INTO levhalar (masa_id, title, type, icon, config_json, order_index) VALUES (?, 'Malzeme Listesi', 'tablo', '📊', ?, 3)", (masa_id, t_cfg))
    
    k_cfg = json.dumps({"columns": ["Yapılacak", "Devam Ediyor", "Bitti"]})
    cursor.execute("INSERT INTO levhalar (masa_id, title, type, icon, config_json, order_index) VALUES (?, 'Görev Panosu', 'kanban', '📌', ?, 4)", (masa_id, k_cfg))

    conn.commit()
    conn.close()
    return {"status": "success", "oba_id": oba_id}


@eoba_router.get("/obalar/{oba_id}")
def get_oba_detail(oba_id: int, user_id: Optional[int] = Query(None)):
    conn = get_db()
    cursor = conn.cursor()

    oba = cursor.execute('''
        SELECT o.*, u.display_name as owner_name, u.badge as owner_badge
        FROM obalar o
        JOIN users u ON o.owner_id = u.id
        WHERE o.id = ?
    ''', (oba_id,)).fetchone()

    if not oba:
        conn.close()
        raise HTTPException(status_code=404, detail="Oba bulunamadı")

    d = dict(oba)
    d["is_member"] = False
    d["is_owner"] = (user_id is not None and d["owner_id"] == user_id)
    d["permissions"] = get_user_oba_permissions(cursor, oba_id, user_id)

    if user_id:
        m = cursor.execute("SELECT 1 FROM oba_members WHERE oba_id = ? AND user_id = ?", (oba_id, user_id)).fetchone()
        if m:
            d["is_member"] = True

    user_roles = []
    if user_id:
        r_rows = cursor.execute('''
            SELECT r.* FROM oba_roles r
            JOIN oba_member_roles mr ON r.id = mr.role_id
            WHERE mr.oba_id = ? AND mr.user_id = ?
            ORDER BY r.position DESC
        ''', (oba_id, user_id)).fetchall()
        user_roles = [dict(r) for r in r_rows]
    d["user_roles"] = user_roles

    conn.close()
    return d


@eoba_router.post("/obalar/{oba_id}/join")
def join_oba(oba_id: int, payload: Dict[str, Any] = Body(...)):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id gerekli")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO oba_members (oba_id, user_id) VALUES (?, ?)", (oba_id, user_id))
    conn.commit()
    conn.close()
    return {"status": "success"}


@eoba_router.post("/obalar/{oba_id}/leave")
def leave_oba(oba_id: int, payload: Dict[str, Any] = Body(...)):
    user_id = payload.get("user_id")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM oba_members WHERE oba_id = ? AND user_id = ?", (oba_id, user_id))
    cursor.execute("DELETE FROM oba_member_roles WHERE oba_id = ? AND user_id = ?", (oba_id, user_id))
    conn.commit()
    conn.close()
    return {"status": "success"}


@eoba_router.put("/obalar/{oba_id}")
def update_oba(oba_id: int, payload: ObaUpdateModel):
    conn = get_db()
    cursor = conn.cursor()
    perms = get_user_oba_permissions(cursor, oba_id, payload.user_id)
    if not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Obayı düzenleme yetkiniz yok")

    updates = []
    params = []
    if payload.name is not None:
        updates.append("name = ?")
        params.append(payload.name.strip())
    if payload.description is not None:
        updates.append("description = ?")
        params.append(payload.description.strip())
    if payload.avatar_url is not None:
        updates.append("avatar_url = ?")
        params.append(payload.avatar_url.strip())
    if payload.banner_url is not None:
        updates.append("banner_url = ?")
        params.append(payload.banner_url.strip())
    if payload.is_public is not None:
        updates.append("is_public = ?")
        params.append(payload.is_public)

    if updates:
        params.append(oba_id)
        cursor.execute(f"UPDATE obalar SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()

    conn.close()
    return {"status": "success"}


@eoba_router.delete("/obalar/{oba_id}")
def delete_oba(oba_id: int, user_id: int = Query(...)):
    conn = get_db()
    cursor = conn.cursor()
    perms = get_user_oba_permissions(cursor, oba_id, user_id)
    if not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Yetkiniz yetersiz")

    cursor.execute("DELETE FROM obalar WHERE id = ?", (oba_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


# ----------------- ENDPOINT'LER: ROLLER VE ETİKETLER (TAG'LER) -----------------

@eoba_router.get("/obalar/{oba_id}/roles")
def get_oba_roles(oba_id: int):
    conn = get_db()
    cursor = conn.cursor()
    rows = cursor.execute('''
        SELECT r.*,
               (SELECT COUNT(*) FROM oba_member_roles WHERE role_id = r.id) as member_count
        FROM oba_roles r
        WHERE r.oba_id = ?
        ORDER BY r.position DESC, r.id ASC
    ''', (oba_id,)).fetchall()
    
    result = []
    for r in rows:
        d = dict(r)
        d["permissions"] = json.loads(d["permissions"]) if d["permissions"] else []
        result.append(d)
    conn.close()
    return result


@eoba_router.post("/obalar/{oba_id}/roles")
def create_oba_role(oba_id: int, payload: RoleCreateModel):
    conn = get_db()
    cursor = conn.cursor()
    perms = get_user_oba_permissions(cursor, oba_id, payload.user_id)
    if not perms.get("manage_roles") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Rol yönetme yetkiniz yok")

    perms_json = json.dumps(payload.permissions)
    cursor.execute('''
        INSERT INTO oba_roles (oba_id, name, color, position, permissions)
        VALUES (?, ?, ?, ?, ?)
    ''', (oba_id, payload.name, payload.color, payload.position, perms_json))
    role_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"status": "success", "role_id": role_id}


@eoba_router.put("/obalar/{oba_id}/roles/{role_id}")
def update_oba_role(oba_id: int, role_id: int, payload: RoleUpdateModel):
    conn = get_db()
    cursor = conn.cursor()
    perms = get_user_oba_permissions(cursor, oba_id, payload.user_id)
    if not perms.get("manage_roles") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Rol yönetme yetkiniz yok")

    updates = []
    params = []
    if payload.name is not None:
        updates.append("name = ?")
        params.append(payload.name)
    if payload.color is not None:
        updates.append("color = ?")
        params.append(payload.color)
    if payload.position is not None:
        updates.append("position = ?")
        params.append(payload.position)
    if payload.permissions is not None:
        updates.append("permissions = ?")
        params.append(json.dumps(payload.permissions))

    if updates:
        params.extend([role_id, oba_id])
        cursor.execute(f"UPDATE oba_roles SET {', '.join(updates)} WHERE id = ? AND oba_id = ?", params)
        conn.commit()

    conn.close()
    return {"status": "success"}


@eoba_router.delete("/obalar/{oba_id}/roles/{role_id}")
def delete_oba_role(oba_id: int, role_id: int, user_id: int = Query(...)):
    conn = get_db()
    cursor = conn.cursor()
    perms = get_user_oba_permissions(cursor, oba_id, user_id)
    if not perms.get("manage_roles") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Rol yönetme yetkiniz yok")

    cursor.execute("DELETE FROM oba_roles WHERE id = ? AND oba_id = ? AND is_default = 0", (role_id, oba_id))
    cursor.execute("DELETE FROM oba_member_roles WHERE role_id = ?", (role_id,))
    cursor.execute("DELETE FROM permission_overrides WHERE role_id = ?", (role_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


# ----------------- ENDPOINT'LER: ÜYELER & ROL ATAMA -----------------

@eoba_router.get("/obalar/{oba_id}/members")
def get_oba_members(oba_id: int):
    conn = get_db()
    cursor = conn.cursor()

    members = cursor.execute('''
        SELECT m.user_id, m.joined_at, u.display_name, u.email, u.profile_image, u.badge
        FROM oba_members m
        JOIN users u ON m.user_id = u.id
        WHERE m.oba_id = ?
        ORDER BY m.joined_at ASC
    ''', (oba_id,)).fetchall()

    result = []
    for m in members:
        d = dict(m)
        roles = cursor.execute('''
            SELECT r.id, r.name, r.color, r.position
            FROM oba_roles r
            JOIN oba_member_roles mr ON r.id = mr.role_id
            WHERE mr.oba_id = ? AND mr.user_id = ?
            ORDER BY r.position DESC
        ''', (oba_id, d["user_id"])).fetchall()
        d["roles"] = [dict(r) for r in roles]
        result.append(d)

    conn.close()
    return result


@eoba_router.post("/obalar/{oba_id}/members/{target_user_id}/roles")
def set_member_roles(oba_id: int, target_user_id: int, payload: MemberRolesUpdateModel):
    conn = get_db()
    cursor = conn.cursor()
    perms = get_user_oba_permissions(cursor, oba_id, payload.user_id)
    if not perms.get("manage_roles") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Rol atama yetkiniz yok")

    cursor.execute("DELETE FROM oba_member_roles WHERE oba_id = ? AND user_id = ?", (oba_id, target_user_id))
    for r_id in payload.role_ids:
        cursor.execute("INSERT INTO oba_member_roles (oba_id, user_id, role_id) VALUES (?, ?, ?)", (oba_id, target_user_id, r_id))

    conn.commit()
    conn.close()
    return {"status": "success"}


# ----------------- ENDPOINT'LER: HİYERARŞİ AĞACI (ÇADIR, MASA, LEVHA) -----------------

@eoba_router.get("/obalar/{oba_id}/tree")
def get_oba_tree(oba_id: int, user_id: Optional[int] = Query(None)):
    conn = get_db()
    cursor = conn.cursor()

    oba_perms = get_user_oba_permissions(cursor, oba_id, user_id)

    cadir_rows = cursor.execute('''
        SELECT * FROM cadirlar WHERE oba_id = ? ORDER BY order_index ASC, id ASC
    ''', (oba_id,)).fetchall()

    tree = []
    for c in cadir_rows:
        cadir_dict = dict(c)
        c_perms = get_user_oba_permissions(cursor, oba_id, user_id, "cadir", c["id"])
        if not c_perms["view"]:
            continue
        cadir_dict["permissions"] = c_perms

        masa_rows = cursor.execute('''
            SELECT * FROM masalar WHERE cadir_id = ? ORDER BY order_index ASC, id ASC
        ''', (c["id"],)).fetchall()

        masalar = []
        for m in masa_rows:
            m_dict = dict(m)
            m_perms = get_user_oba_permissions(cursor, oba_id, user_id, "masa", m["id"])
            if not m_perms["view"]:
                continue
            m_dict["permissions"] = m_perms

            levha_rows = cursor.execute('''
                SELECT * FROM levhalar WHERE masa_id = ? ORDER BY order_index ASC, id ASC
            ''', (m["id"],)).fetchall()

            levhalar = []
            for l in levha_rows:
                l_dict = dict(l)
                l_perms = get_user_oba_permissions(cursor, oba_id, user_id, "levha", l["id"])
                if not l_perms["view"]:
                    continue
                l_dict["permissions"] = l_perms
                if l_dict.get("config_json"):
                    try:
                        l_dict["config"] = json.loads(l_dict["config_json"])
                    except:
                        l_dict["config"] = {}
                levhalar.append(l_dict)

            m_dict["levhalar"] = levhalar
            masalar.append(m_dict)

        cadir_dict["masalar"] = masalar
        tree.append(cadir_dict)

    conn.close()
    return {"oba_permissions": oba_perms, "tree": tree}


# Çadır İşlemleri
@eoba_router.post("/cadirlar")
def create_cadir(payload: CadirCreateModel):
    conn = get_db()
    cursor = conn.cursor()
    perms = get_user_oba_permissions(cursor, payload.oba_id, payload.user_id)
    if not perms.get("manage_structure") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Çadır açma yetkiniz yok")

    cursor.execute("INSERT INTO cadirlar (oba_id, name, order_index) VALUES (?, ?, ?)",
                   (payload.oba_id, payload.name, payload.order_index))
    cadir_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"status": "success", "cadir_id": cadir_id}


@eoba_router.delete("/cadirlar/{cadir_id}")
def delete_cadir(cadir_id: int, user_id: int = Query(...)):
    conn = get_db()
    cursor = conn.cursor()
    c = cursor.execute("SELECT oba_id FROM cadirlar WHERE id = ?", (cadir_id,)).fetchone()
    if not c:
        conn.close()
        raise HTTPException(status_code=404, detail="Çadır bulunamadı")

    perms = get_user_oba_permissions(cursor, c["oba_id"], user_id)
    if not perms.get("manage_structure") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Çadır silme yetkiniz yok")

    cursor.execute("DELETE FROM cadirlar WHERE id = ?", (cadir_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@eoba_router.put("/cadirlar/{cadir_id}")
def update_cadir(cadir_id: int, payload: ItemRenameModel):
    conn = get_db()
    cursor = conn.cursor()
    c = cursor.execute("SELECT oba_id FROM cadirlar WHERE id = ?", (cadir_id,)).fetchone()
    if not c:
        conn.close()
        raise HTTPException(status_code=404, detail="Çadır bulunamadı")

    perms = get_user_oba_permissions(cursor, c["oba_id"], payload.user_id)
    if not perms.get("manage_structure") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Çadırı düzenleme yetkiniz yok")

    cursor.execute("UPDATE cadirlar SET name = ? WHERE id = ?", (payload.name.strip(), cadir_id))
    conn.commit()
    conn.close()
    return {"status": "success"}


# Masa İşlemleri
@eoba_router.post("/masalar")
def create_masa(payload: MasaCreateModel):
    conn = get_db()
    cursor = conn.cursor()
    c = cursor.execute("SELECT oba_id FROM cadirlar WHERE id = ?", (payload.cadir_id,)).fetchone()
    if not c:
        conn.close()
        raise HTTPException(status_code=404, detail="Çadır bulunamadı")

    perms = get_user_oba_permissions(cursor, c["oba_id"], payload.user_id)
    if not perms.get("manage_structure") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Masa açma yetkiniz yok")

    cursor.execute("INSERT INTO masalar (cadir_id, name, icon, order_index) VALUES (?, ?, ?, ?)",
                   (payload.cadir_id, payload.name, payload.icon, payload.order_index))
    masa_id = cursor.lastrowid

    cursor.execute("INSERT INTO levhalar (masa_id, title, type, icon, order_index) VALUES (?, 'Sohbet', 'chat', '💬', 1)", (masa_id,))

    conn.commit()
    conn.close()
    return {"status": "success", "masa_id": masa_id}


@eoba_router.delete("/masalar/{masa_id}")
def delete_masa(masa_id: int, user_id: int = Query(...)):
    conn = get_db()
    cursor = conn.cursor()
    m = cursor.execute('''
        SELECT c.oba_id FROM masalar m
        JOIN cadirlar c ON m.cadir_id = c.id
        WHERE m.id = ?
    ''', (masa_id,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Masa bulunamadı")

    perms = get_user_oba_permissions(cursor, m["oba_id"], user_id)
    if not perms.get("manage_structure") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Masa silme yetkiniz yok")

    cursor.execute("DELETE FROM masalar WHERE id = ?", (masa_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@eoba_router.put("/masalar/{masa_id}")
def update_masa(masa_id: int, payload: ItemRenameModel):
    conn = get_db()
    cursor = conn.cursor()
    m = cursor.execute('''
        SELECT c.oba_id FROM masalar m
        JOIN cadirlar c ON m.cadir_id = c.id
        WHERE m.id = ?
    ''', (masa_id,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Masa bulunamadı")

    perms = get_user_oba_permissions(cursor, m["oba_id"], payload.user_id)
    if not perms.get("manage_structure") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Masayı düzenleme yetkiniz yok")

    cursor.execute("UPDATE masalar SET name = ? WHERE id = ?", (payload.name.strip(), masa_id))
    conn.commit()
    conn.close()
    return {"status": "success"}



# Levha İşlemleri
@eoba_router.post("/levhalar")
def create_levha(payload: LevhaCreateModel):
    conn = get_db()
    cursor = conn.cursor()
    m = cursor.execute('''
        SELECT c.oba_id FROM masalar m
        JOIN cadirlar c ON m.cadir_id = c.id
        WHERE m.id = ?
    ''', (payload.masa_id,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Masa bulunamadı")

    perms = get_user_oba_permissions(cursor, m["oba_id"], payload.user_id)
    if not perms.get("manage_structure") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Levha açma yetkiniz yok")

    icon = payload.icon
    if not icon:
        if payload.type == "chat": icon = "💬"
        elif payload.type == "duyuru": icon = "📢"
        elif payload.type == "tablo": icon = "📊"
        elif payload.type == "kanban": icon = "📌"
        else: icon = "📋"

    cfg_str = json.dumps(payload.config_json or {})
    if payload.type == "tablo" and not payload.config_json:
        cfg_str = json.dumps({"columns": ["Sütun 1", "Sütun 2", "Sütun 3", "Durum"]})
    elif payload.type == "kanban" and not payload.config_json:
        cfg_str = json.dumps({"columns": ["Yapılacak", "Devam Ediyor", "Tamamlandı"]})

    cursor.execute('''
        INSERT INTO levhalar (masa_id, title, type, icon, config_json, order_index)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (payload.masa_id, payload.title, payload.type, icon, cfg_str, payload.order_index))
    levha_id = cursor.lastrowid

    conn.commit()
    conn.close()
    return {"status": "success", "levha_id": levha_id}


@eoba_router.delete("/levhalar/{levha_id}")
def delete_levha(levha_id: int, user_id: int = Query(...)):
    conn = get_db()
    cursor = conn.cursor()
    l = cursor.execute('''
        SELECT c.oba_id FROM levhalar l
        JOIN masalar m ON l.masa_id = m.id
        JOIN cadirlar c ON m.cadir_id = c.id
        WHERE l.id = ?
    ''', (levha_id,)).fetchone()
    if not l:
        conn.close()
        raise HTTPException(status_code=404, detail="Levha bulunamadı")

    perms = get_user_oba_permissions(cursor, l["oba_id"], user_id)
    if not perms.get("manage_structure") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Levha silme yetkiniz yok")

    cursor.execute("DELETE FROM levhalar WHERE id = ?", (levha_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@eoba_router.put("/levhalar/{levha_id}")
def update_levha(levha_id: int, payload: ItemRenameModel):
    conn = get_db()
    cursor = conn.cursor()
    l = cursor.execute('''
        SELECT c.oba_id FROM levhalar l
        JOIN masalar m ON l.masa_id = m.id
        JOIN cadirlar c ON m.cadir_id = c.id
        WHERE l.id = ?
    ''', (levha_id,)).fetchone()
    if not l:
        conn.close()
        raise HTTPException(status_code=404, detail="Levha bulunamadı")

    perms = get_user_oba_permissions(cursor, l["oba_id"], payload.user_id)
    if not perms.get("manage_structure") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Levhayı düzenleme yetkiniz yok")

    cursor.execute("UPDATE levhalar SET title = ? WHERE id = ?", (payload.name.strip(), levha_id))
    conn.commit()
    conn.close()
    return {"status": "success"}



# ----------------- ENDPOINT'LER: HEDEF BAZLI YETKİ GEÇERSİZ KILMA (PERMS OVERRIDE) -----------------

@eoba_router.get("/permissions/{target_type}/{target_id}")
def get_target_permissions(target_type: str, target_id: int):
    conn = get_db()
    cursor = conn.cursor()
    rows = cursor.execute('''
        SELECT p.*, r.name as role_name, r.color as role_color
        FROM permission_overrides p
        JOIN oba_roles r ON p.role_id = r.id
        WHERE p.target_type = ? AND p.target_id = ?
    ''', (target_type, target_id)).fetchall()

    result = []
    for r in rows:
        d = dict(r)
        d["allow_perms"] = json.loads(d["allow_perms"]) if d["allow_perms"] else []
        d["deny_perms"] = json.loads(d["deny_perms"]) if d["deny_perms"] else []
        result.append(d)

    conn.close()
    return result


@eoba_router.post("/permissions/{target_type}/{target_id}")
def set_target_permission(target_type: str, target_id: int, payload: PermissionOverrideModel):
    conn = get_db()
    cursor = conn.cursor()

    oba_id = None
    if target_type == "cadir":
        c = cursor.execute("SELECT oba_id FROM cadirlar WHERE id = ?", (target_id,)).fetchone()
        if c: oba_id = c["oba_id"]
    elif target_type == "masa":
        m = cursor.execute("SELECT c.oba_id FROM masalar m JOIN cadirlar c ON m.cadir_id = c.id WHERE m.id = ?", (target_id,)).fetchone()
        if m: oba_id = m["oba_id"]
    elif target_type == "levha":
        l = cursor.execute("SELECT c.oba_id FROM levhalar l JOIN masalar m ON l.masa_id = m.id JOIN cadirlar c ON m.cadir_id = c.id WHERE l.id = ?", (target_id,)).fetchone()
        if l: oba_id = l["oba_id"]

    if not oba_id:
        conn.close()
        raise HTTPException(status_code=404, detail="Hedef nesne bulunamadı")

    perms = get_user_oba_permissions(cursor, oba_id, payload.user_id)
    if not perms.get("manage_roles") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Yetki değiştirme izniniz yok")

    allow_str = json.dumps(payload.allow_perms)
    deny_str = json.dumps(payload.deny_perms)

    cursor.execute('''
        INSERT INTO permission_overrides (target_type, target_id, role_id, allow_perms, deny_perms)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(target_type, target_id, role_id)
        DO UPDATE SET allow_perms = excluded.allow_perms, deny_perms = excluded.deny_perms
    ''', (target_type, target_id, payload.role_id, allow_str, deny_str))

    conn.commit()
    conn.close()
    return {"status": "success"}


# ----------------- 1. SOHBET LEVHASI ENDPOINT'LERİ -----------------

@eoba_router.get("/levhalar/{levha_id}/chat")
def get_chat_messages(levha_id: int, user_id: Optional[int] = Query(None)):
    conn = get_db()
    cursor = conn.cursor()

    rows = cursor.execute('''
        SELECT m.*, u.display_name, u.profile_image, u.badge
        FROM levha_chat_messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.levha_id = ?
        ORDER BY m.created_at ASC
    ''', (levha_id,)).fetchall()

    l = cursor.execute("SELECT c.oba_id FROM levhalar l JOIN masalar m ON l.masa_id = m.id JOIN cadirlar c ON m.cadir_id = c.id WHERE l.id = ?", (levha_id,)).fetchone()
    oba_id = l["oba_id"] if l else None

    result = []
    for r in rows:
        d = dict(r)
        d["user_role"] = None
        if oba_id:
            role = cursor.execute('''
                SELECT r.name, r.color FROM oba_roles r
                JOIN oba_member_roles mr ON r.id = mr.role_id
                WHERE mr.oba_id = ? AND mr.user_id = ?
                ORDER BY r.position DESC LIMIT 1
            ''', (oba_id, d["user_id"])).fetchone()
            if role:
                d["user_role"] = dict(role)
        result.append(d)

    conn.close()
    return result


@eoba_router.post("/levhalar/{levha_id}/chat")
def post_chat_message(levha_id: int, payload: ChatMessageModel):
    conn = get_db()
    cursor = conn.cursor()

    l = cursor.execute("SELECT c.oba_id FROM levhalar l JOIN masalar m ON l.masa_id = m.id JOIN cadirlar c ON m.cadir_id = c.id WHERE l.id = ?", (levha_id,)).fetchone()
    if not l:
        conn.close()
        raise HTTPException(status_code=404, detail="Levha bulunamadı")

    perms = get_user_oba_permissions(cursor, l["oba_id"], payload.user_id, "levha", levha_id)
    if not perms.get("write") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Bu levhaya yazma yetkiniz yok")

    cursor.execute('''
        INSERT INTO levha_chat_messages (levha_id, user_id, content, file_url)
        VALUES (?, ?, ?, ?)
    ''', (levha_id, payload.user_id, payload.content, payload.file_url))

    msg_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"status": "success", "message_id": msg_id}


@eoba_router.delete("/levhalar/chat/{msg_id}")
def delete_chat_message(msg_id: int, user_id: int = Query(...)):
    conn = get_db()
    cursor = conn.cursor()
    m = cursor.execute('''
        SELECT msg.user_id, c.oba_id, msg.levha_id
        FROM levha_chat_messages msg
        JOIN levhalar l ON msg.levha_id = l.id
        JOIN masalar msa ON l.masa_id = msa.id
        JOIN cadirlar c ON msa.cadir_id = c.id
        WHERE msg.id = ?
    ''', (msg_id,)).fetchone()

    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")

    perms = get_user_oba_permissions(cursor, m["oba_id"], user_id, "levha", m["levha_id"])
    if m["user_id"] != user_id and not perms.get("manage_content") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Mesaj silme yetkiniz yok")

    cursor.execute("DELETE FROM levha_chat_messages WHERE id = ?", (msg_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


# ----------------- 2. DUYURU LEVHASI ENDPOINT'LERİ -----------------

@eoba_router.get("/levhalar/{levha_id}/announcements")
def get_announcements(levha_id: int):
    conn = get_db()
    cursor = conn.cursor()
    rows = cursor.execute('''
        SELECT a.*, u.display_name, u.profile_image, u.badge
        FROM levha_announcements a
        JOIN users u ON a.user_id = u.id
        WHERE a.levha_id = ?
        ORDER BY a.is_pinned DESC, a.created_at DESC
    ''', (levha_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@eoba_router.post("/levhalar/{levha_id}/announcements")
def post_announcement(levha_id: int, payload: AnnouncementModel):
    conn = get_db()
    cursor = conn.cursor()

    l = cursor.execute("SELECT c.oba_id FROM levhalar l JOIN masalar m ON l.masa_id = m.id JOIN cadirlar c ON m.cadir_id = c.id WHERE l.id = ?", (levha_id,)).fetchone()
    if not l:
        conn.close()
        raise HTTPException(status_code=404, detail="Levha bulunamadı")

    perms = get_user_oba_permissions(cursor, l["oba_id"], payload.user_id, "levha", levha_id)
    if not perms.get("manage_content") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Duyuru yayınlama yetkiniz yok (Yetkili rol gerektirir)")

    cursor.execute('''
        INSERT INTO levha_announcements (levha_id, user_id, title, content, is_pinned)
        VALUES (?, ?, ?, ?, ?)
    ''', (levha_id, payload.user_id, payload.title, payload.content, payload.is_pinned))

    ann_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"status": "success", "announcement_id": ann_id}


@eoba_router.delete("/levhalar/announcements/{ann_id}")
def delete_announcement(ann_id: int, user_id: int = Query(...)):
    conn = get_db()
    cursor = conn.cursor()
    a = cursor.execute('''
        SELECT ann.user_id, c.oba_id, ann.levha_id
        FROM levha_announcements ann
        JOIN levhalar l ON ann.levha_id = l.id
        JOIN masalar msa ON l.masa_id = msa.id
        JOIN cadirlar c ON msa.cadir_id = c.id
        WHERE ann.id = ?
    ''', (ann_id,)).fetchone()

    if not a:
        conn.close()
        raise HTTPException(status_code=404, detail="Duyuru bulunamadı")

    perms = get_user_oba_permissions(cursor, a["oba_id"], user_id, "levha", a["levha_id"])
    if a["user_id"] != user_id and not perms.get("manage_content") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Duyuru silme yetkiniz yok")

    cursor.execute("DELETE FROM levha_announcements WHERE id = ?", (ann_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


# ----------------- 3. TABLO LEVHASI (EXCEL / BOM) ENDPOINT'LERİ -----------------

@eoba_router.get("/levhalar/{levha_id}/table")
def get_table_data(levha_id: int):
    conn = get_db()
    cursor = conn.cursor()

    levha = cursor.execute("SELECT config_json FROM levhalar WHERE id = ?", (levha_id,)).fetchone()
    columns = ["Parça / Malzeme", "Miktar", "Birim Fiyat", "Durum"]
    if levha and levha["config_json"]:
        try:
            cfg = json.loads(levha["config_json"])
            if "columns" in cfg:
                columns = cfg["columns"]
        except:
            pass

    rows = cursor.execute('''
        SELECT * FROM levha_table_rows WHERE levha_id = ? ORDER BY order_index ASC, id ASC
    ''', (levha_id,)).fetchall()

    row_list = []
    for r in rows:
        d = dict(r)
        try:
            d["data"] = json.loads(d["row_data"])
        except:
            d["data"] = {}
        row_list.append(d)

    conn.close()
    return {"columns": columns, "rows": row_list}


@eoba_router.post("/levhalar/{levha_id}/table/config")
def update_table_config(levha_id: int, payload: TableConfigModel):
    conn = get_db()
    cursor = conn.cursor()
    l = cursor.execute("SELECT c.oba_id FROM levhalar l JOIN masalar m ON l.masa_id = m.id JOIN cadirlar c ON m.cadir_id = c.id WHERE l.id = ?", (levha_id,)).fetchone()
    if not l:
        conn.close()
        raise HTTPException(status_code=404, detail="Levha bulunamadı")

    perms = get_user_oba_permissions(cursor, l["oba_id"], payload.user_id, "levha", levha_id)
    if not perms.get("write") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Tablo düzenleme yetkiniz yok")

    cfg_str = json.dumps({"columns": payload.columns})
    cursor.execute("UPDATE levhalar SET config_json = ? WHERE id = ?", (cfg_str, levha_id))
    conn.commit()
    conn.close()
    return {"status": "success"}


@eoba_router.post("/levhalar/{levha_id}/table/row")
def add_table_row(levha_id: int, payload: TableRowModel):
    conn = get_db()
    cursor = conn.cursor()
    l = cursor.execute("SELECT c.oba_id FROM levhalar l JOIN masalar m ON l.masa_id = m.id JOIN cadirlar c ON m.cadir_id = c.id WHERE l.id = ?", (levha_id,)).fetchone()
    if not l:
        conn.close()
        raise HTTPException(status_code=404, detail="Levha bulunamadı")

    perms = get_user_oba_permissions(cursor, l["oba_id"], payload.user_id, "levha", levha_id)
    if not perms.get("write") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Tabloya veri ekleme yetkiniz yok")

    row_data_str = json.dumps(payload.row_data)
    cursor.execute("INSERT INTO levha_table_rows (levha_id, row_data) VALUES (?, ?)", (levha_id, row_data_str))
    row_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"status": "success", "row_id": row_id}


@eoba_router.put("/levhalar/table/row/{row_id}")
def update_table_row(row_id: int, payload: TableRowModel):
    conn = get_db()
    cursor = conn.cursor()
    r = cursor.execute('''
        SELECT r.levha_id, c.oba_id FROM levha_table_rows r
        JOIN levhalar l ON r.levha_id = l.id
        JOIN masalar m ON l.masa_id = m.id
        JOIN cadirlar c ON m.cadir_id = c.id
        WHERE r.id = ?
    ''', (row_id,)).fetchone()
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Satır bulunamadı")

    perms = get_user_oba_permissions(cursor, r["oba_id"], payload.user_id, "levha", r["levha_id"])
    if not perms.get("write") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Tablo verisi düzenleme yetkiniz yok")

    row_data_str = json.dumps(payload.row_data)
    cursor.execute("UPDATE levha_table_rows SET row_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (row_data_str, row_id))
    conn.commit()
    conn.close()
    return {"status": "success"}


@eoba_router.delete("/levhalar/table/row/{row_id}")
def delete_table_row(row_id: int, user_id: int = Query(...)):
    conn = get_db()
    cursor = conn.cursor()
    r = cursor.execute('''
        SELECT r.levha_id, c.oba_id FROM levha_table_rows r
        JOIN levhalar l ON r.levha_id = l.id
        JOIN masalar m ON l.masa_id = m.id
        JOIN cadirlar c ON m.cadir_id = c.id
        WHERE r.id = ?
    ''', (row_id,)).fetchone()
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Satır bulunamadı")

    perms = get_user_oba_permissions(cursor, r["oba_id"], user_id, "levha", r["levha_id"])
    if not perms.get("write") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Satır silme yetkiniz yok")

    cursor.execute("DELETE FROM levha_table_rows WHERE id = ?", (row_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


# ----------------- 4. GÖREV TAKİP (KANBAN) LEVHASI ENDPOINT'LERİ -----------------

@eoba_router.get("/levhalar/{levha_id}/kanban")
def get_kanban_data(levha_id: int):
    conn = get_db()
    cursor = conn.cursor()

    levha = cursor.execute("SELECT config_json FROM levhalar WHERE id = ?", (levha_id,)).fetchone()
    columns = ["Yapılacak", "Devam Ediyor", "Tamamlandı"]
    if levha and levha["config_json"]:
        try:
            cfg = json.loads(levha["config_json"])
            if "columns" in cfg:
                columns = cfg["columns"]
        except:
            pass

    cards = cursor.execute('''
        SELECT k.*, u.display_name as assigned_name
        FROM levha_kanban_cards k
        LEFT JOIN users u ON k.assigned_user_id = u.id
        WHERE k.levha_id = ?
        ORDER BY k.order_index ASC, k.id ASC
    ''', (levha_id,)).fetchall()

    conn.close()
    return {"columns": columns, "cards": [dict(c) for c in cards]}


@eoba_router.post("/levhalar/{levha_id}/kanban/card")
def add_kanban_card(levha_id: int, payload: KanbanCardModel):
    conn = get_db()
    cursor = conn.cursor()
    l = cursor.execute("SELECT c.oba_id FROM levhalar l JOIN masalar m ON l.masa_id = m.id JOIN cadirlar c ON m.cadir_id = c.id WHERE l.id = ?", (levha_id,)).fetchone()
    if not l:
        conn.close()
        raise HTTPException(status_code=404, detail="Levha bulunamadı")

    perms = get_user_oba_permissions(cursor, l["oba_id"], payload.user_id, "levha", levha_id)
    if not perms.get("write") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Kart oluşturma yetkiniz yok")

    cursor.execute('''
        INSERT INTO levha_kanban_cards (levha_id, column_name, title, description, tag, assigned_user_id)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (levha_id, payload.column_name, payload.title, payload.description, payload.tag, payload.assigned_user_id))
    card_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"status": "success", "card_id": card_id}


@eoba_router.put("/levhalar/kanban/card/{card_id}")
def update_kanban_card(card_id: int, payload: KanbanCardUpdateModel):
    conn = get_db()
    cursor = conn.cursor()
    c = cursor.execute('''
        SELECT k.levha_id, c.oba_id FROM levha_kanban_cards k
        JOIN levhalar l ON k.levha_id = l.id
        JOIN masalar m ON l.masa_id = m.id
        JOIN cadirlar c ON m.cadir_id = c.id
        WHERE k.id = ?
    ''', (card_id,)).fetchone()
    if not c:
        conn.close()
        raise HTTPException(status_code=404, detail="Kart bulunamadı")

    perms = get_user_oba_permissions(cursor, c["oba_id"], payload.user_id, "levha", c["levha_id"])
    if not perms.get("write") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Kart güncelleme yetkiniz yok")

    updates = []
    params = []
    if payload.column_name is not None:
        updates.append("column_name = ?")
        params.append(payload.column_name)
    if payload.title is not None:
        updates.append("title = ?")
        params.append(payload.title)
    if payload.description is not None:
        updates.append("description = ?")
        params.append(payload.description)
    if payload.tag is not None:
        updates.append("tag = ?")
        params.append(payload.tag)
    if payload.assigned_user_id is not None:
        updates.append("assigned_user_id = ?")
        params.append(payload.assigned_user_id)

    if updates:
        params.append(card_id)
        cursor.execute(f"UPDATE levha_kanban_cards SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()

    conn.close()
    return {"status": "success"}


@eoba_router.delete("/levhalar/kanban/card/{card_id}")
def delete_kanban_card(card_id: int, user_id: int = Query(...)):
    conn = get_db()
    cursor = conn.cursor()
    c = cursor.execute('''
        SELECT k.levha_id, c.oba_id FROM levha_kanban_cards k
        JOIN levhalar l ON k.levha_id = l.id
        JOIN masalar m ON l.masa_id = m.id
        JOIN cadirlar c ON m.cadir_id = c.id
        WHERE k.id = ?
    ''', (card_id,)).fetchone()
    if not c:
        conn.close()
        raise HTTPException(status_code=404, detail="Kart bulunamadı")

    perms = get_user_oba_permissions(cursor, c["oba_id"], user_id, "levha", c["levha_id"])
    if not perms.get("write") and not perms.get("admin"):
        conn.close()
        raise HTTPException(status_code=403, detail="Kart silme yetkiniz yok")

    cursor.execute("DELETE FROM levha_kanban_cards WHERE id = ?", (card_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


# ----------------- 13. OBA DAVET SİSTEMİ ENDPOINTLERİ -----------------

@eoba_router.post("/obalar/{oba_id}/invites")
def create_oba_invite(oba_id: int, payload: InviteCreateModel):
    conn = get_db()
    cursor = conn.cursor()

    # Oba var mı?
    oba = cursor.execute("SELECT id, name, is_public FROM obalar WHERE id = ?", (oba_id,)).fetchone()
    if not oba:
        conn.close()
        raise HTTPException(status_code=404, detail="Oba bulunamadı")

    # Kullanıcı üye mi veya yetkili mi?
    is_member = cursor.execute("SELECT 1 FROM oba_members WHERE oba_id = ? AND user_id = ?", (oba_id, payload.user_id)).fetchone()
    if not is_member:
        conn.close()
        raise HTTPException(status_code=403, detail="Davet linki oluşturmak için bu obanın üyesi olmalısınız")

    # Eğer sınırsız ve süresiz davet isteniyorsa, önceden oluşturulmuş aktif bir link varsa onu döndür
    if not payload.max_uses and not payload.expires_days:
        existing = cursor.execute('''
            SELECT * FROM oba_invites 
            WHERE oba_id = ? AND max_uses IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            ORDER BY id DESC LIMIT 1
        ''', (oba_id,)).fetchone()
        if existing:
            conn.close()
            return dict(existing)

    # Yeni benzersiz kod üret
    code = secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:7]
    expires_at = None
    if payload.expires_days:
        expires_at = (datetime.utcnow() + timedelta(days=payload.expires_days)).strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute('''
        INSERT INTO oba_invites (oba_id, code, created_by, max_uses, expires_at)
        VALUES (?, ?, ?, ?, ?)
    ''', (oba_id, code, payload.user_id, payload.max_uses, expires_at))
    conn.commit()

    invite = cursor.execute("SELECT * FROM oba_invites WHERE id = ?", (cursor.lastrowid,)).fetchone()
    conn.close()
    return dict(invite)


@eoba_router.get("/obalar/{oba_id}/invites")
def get_oba_invites(oba_id: int, user_id: int = Query(...)):
    conn = get_db()
    cursor = conn.cursor()
    invites = cursor.execute('''
        SELECT i.*, u.display_name as creator_name
        FROM oba_invites i
        JOIN users u ON i.created_by = u.id
        WHERE i.oba_id = ? AND (i.expires_at IS NULL OR i.expires_at > CURRENT_TIMESTAMP)
        ORDER BY i.id DESC
    ''', (oba_id,)).fetchall()
    conn.close()
    return [dict(inv) for inv in invites]


@eoba_router.get("/invites/{code}")
def get_invite_preview(code: str):
    conn = get_db()
    cursor = conn.cursor()
    inv = cursor.execute("SELECT * FROM oba_invites WHERE code = ?", (code,)).fetchone()
    if not inv:
        conn.close()
        raise HTTPException(status_code=404, detail="Davet linki geçersiz veya bulunamadı")

    # Kullanım limiti ve süre kontrolü
    if inv["max_uses"] and inv["uses_count"] >= inv["max_uses"]:
        conn.close()
        raise HTTPException(status_code=410, detail="Bu davet linkinin kullanım limiti dolmuş")

    if inv["expires_at"]:
        exp = datetime.strptime(inv["expires_at"], "%Y-%m-%d %H:%M:%S")
        if datetime.utcnow() > exp:
            conn.close()
            raise HTTPException(status_code=410, detail="Bu davet linkinin süresi dolmuş")

    oba = cursor.execute('''
        SELECT o.id, o.name, o.description, o.avatar_url, o.is_public,
               COUNT(m.user_id) as member_count
        FROM obalar o
        LEFT JOIN oba_members m ON o.id = m.oba_id
        WHERE o.id = ?
        GROUP BY o.id
    ''', (inv["oba_id"],)).fetchone()

    conn.close()
    if not oba:
        raise HTTPException(status_code=404, detail="Bağlı oba bulunamadı")

    return {
        "valid": True,
        "code": code,
        "oba": dict(oba)
    }


@eoba_router.post("/invites/use")
def use_oba_invite(payload: InviteUseModel):
    conn = get_db()
    cursor = conn.cursor()

    inv = cursor.execute("SELECT * FROM oba_invites WHERE code = ?", (payload.code,)).fetchone()
    if not inv:
        conn.close()
        raise HTTPException(status_code=404, detail="Geçersiz davet kodu")

    if inv["max_uses"] and inv["uses_count"] >= inv["max_uses"]:
        conn.close()
        raise HTTPException(status_code=410, detail="Bu davet linkinin kullanım limiti dolmuş")

    if inv["expires_at"]:
        exp = datetime.strptime(inv["expires_at"], "%Y-%m-%d %H:%M:%S")
        if datetime.utcnow() > exp:
            conn.close()
            raise HTTPException(status_code=410, detail="Bu davet linkinin süresi dolmuş")

    oba_id = inv["oba_id"]
    oba = cursor.execute("SELECT id, name FROM obalar WHERE id = ?", (oba_id,)).fetchone()

    # Kullanıcı zaten üye mi?
    is_already = cursor.execute("SELECT 1 FROM oba_members WHERE oba_id = ? AND user_id = ?", (oba_id, payload.user_id)).fetchone()
    if not is_already:
        cursor.execute("INSERT OR IGNORE INTO oba_members (oba_id, user_id) VALUES (?, ?)", (oba_id, payload.user_id))
        
        # Varsayılan rol varsa ata
        def_role = cursor.execute("SELECT id FROM oba_roles WHERE oba_id = ? AND is_default = 1", (oba_id,)).fetchone()
        if def_role:
            cursor.execute("INSERT OR IGNORE INTO oba_member_roles (oba_id, user_id, role_id) VALUES (?, ?, ?)", (oba_id, payload.user_id, def_role["id"]))

        # Kullanım sayısını artır
        cursor.execute("UPDATE oba_invites SET uses_count = uses_count + 1 WHERE id = ?", (inv["id"],))
        conn.commit()

    conn.close()
    return {
        "status": "success",
        "oba_id": oba_id,
        "name": oba["name"] if oba else "E-Oba"
    }


@eoba_router.get("/users/search")
def search_users_for_invite(q: str = Query(...), oba_id: Optional[int] = None):
    query = f"%{q.strip().lower()}%"
    conn = get_db()
    cursor = conn.cursor()

    rows = cursor.execute('''
        SELECT id, display_name, email, profile_image, badge
        FROM users
        WHERE LOWER(display_name) LIKE ? OR LOWER(email) LIKE ?
        LIMIT 10
    ''', (query, query)).fetchall()

    result = []
    for r in rows:
        d = dict(r)
        if oba_id:
            m = cursor.execute("SELECT 1 FROM oba_members WHERE oba_id = ? AND user_id = ?", (oba_id, r["id"])).fetchone()
            d["is_member"] = bool(m)
        else:
            d["is_member"] = False
        result.append(d)

    conn.close()
    return result


@eoba_router.post("/obalar/{oba_id}/invite-user")
def invite_user_directly(oba_id: int, payload: DirectInviteModel):
    conn = get_db()
    cursor = conn.cursor()

    # Oba bilgisi
    oba = cursor.execute("SELECT id, name FROM obalar WHERE id = ?", (oba_id,)).fetchone()
    if not oba:
        conn.close()
        raise HTTPException(status_code=404, detail="Oba bulunamadı")

    # Gönderen bilgisi
    sender = cursor.execute("SELECT id, display_name FROM users WHERE id = ?", (payload.sender_id,)).fetchone()
    if not sender:
        conn.close()
        raise HTTPException(status_code=404, detail="Gönderen bulunamadı")

    # Hedef kullanıcıyı bul
    target = cursor.execute('''
        SELECT id, display_name, email 
        FROM users 
        WHERE LOWER(display_name) = ? OR LOWER(email) = ?
    ''', (payload.target_username.strip().lower(), payload.target_username.strip().lower())).fetchone()
    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail=f"'{payload.target_username}' adlı kullanıcı bulunamadı")

    if target["id"] == payload.sender_id:
        conn.close()
        raise HTTPException(status_code=400, detail="Kendinizi davet edemezsiniz")

    # Zaten üye mi?
    is_member = cursor.execute("SELECT 1 FROM oba_members WHERE oba_id = ? AND user_id = ?", (oba_id, target["id"])).fetchone()
    if is_member:
        conn.close()
        raise HTTPException(status_code=400, detail=f"{target['display_name']} zaten bu obanın üyesi")

    # Aktif bir davet kodu bul veya oluştur
    inv = cursor.execute('''
        SELECT code FROM oba_invites 
        WHERE oba_id = ? AND max_uses IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        ORDER BY id DESC LIMIT 1
    ''', (oba_id,)).fetchone()

    if inv:
        invite_code = inv["code"]
    else:
        invite_code = secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:7]
        cursor.execute('''
            INSERT INTO oba_invites (oba_id, code, created_by)
            VALUES (?, ?, ?)
        ''', (oba_id, invite_code, payload.sender_id))

    invite_url = f"/e-oba?davet={invite_code}"

    # 1. Bildirim Tablosuna Ekle (Zil Bildirimi)
    cursor.execute('''
        INSERT INTO notifications (user_id, sender_id, type, title, content, link)
        VALUES (?, ?, 'oba_invite', ?, ?, ?)
    ''', (
        target["id"],
        payload.sender_id,
        f"{oba['name']} Obasına Davet Edildiniz",
        f"{sender['display_name']} sizi '{oba['name']}' atölye obasına davet etti.",
        invite_url
    ))

    # 2. Direkt Mesaj (DM) Gönder
    dm_text = f"Selam {target['display_name']}! Seni '{oba['name']}' atölye obamıza davet ettim. Aramıza katılmak için bu bağlantıya tıklayabilirsin: {invite_url}"
    cursor.execute('''
        INSERT INTO direct_messages (sender_id, receiver_id, message)
        VALUES (?, ?, ?)
    ''', (payload.sender_id, target["id"], dm_text))

    conn.commit()
    conn.close()
    return {
        "status": "success",
        "message": f"{target['display_name']} kullanıcısına davet bildirimi ve mesaj gönderildi!"
    }
