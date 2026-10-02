"""
PostgreSQL'de KaraLevha tablolarını oluşturur.
"""
import os
import sys

# .env'yi yükle
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip())

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("HATA: DATABASE_URL bulunamadı!")
    sys.exit(1)

import psycopg2

print(f"PostgreSQL'e bağlanılıyor...")
conn = psycopg2.connect(DATABASE_URL)
cursor = conn.cursor()

# === TABLOLAR ===

tables_sql = """

-- KULLANICILAR
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
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
);

-- FILAMENT (id TEXT olarak kalmalı - UUID kullanıyor)
CREATE TABLE IF NOT EXISTS filaments (
    id TEXT PRIMARY KEY,
    type TEXT,
    "colorName" TEXT,
    "colorHex" TEXT,
    active INTEGER DEFAULT 1
);

-- FORUM KATEGORİLERİ
CREATE TABLE IF NOT EXISTS forum_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
);

-- FORUM GÖNDERİLERİ
CREATE TABLE IF NOT EXISTS forum_posts (
    id SERIAL PRIMARY KEY,
    category_id INTEGER,
    user_id INTEGER,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT DEFAULT NULL,
    tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES forum_categories(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- FORUM YORUMLARI
CREATE TABLE IF NOT EXISTS forum_comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER,
    user_id INTEGER,
    content TEXT NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    image_url TEXT DEFAULT NULL,
    tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(parent_id) REFERENCES forum_comments(id) ON DELETE CASCADE
);

-- DISCOVER FEED
CREATE TABLE IF NOT EXISTS discover_feed (
    id SERIAL PRIMARY KEY,
    content_type TEXT NOT NULL,
    content_id INTEGER NOT NULL,
    tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SİPARİŞLER
CREATE TABLE IF NOT EXISTS print_orders (
    id SERIAL PRIMARY KEY,
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
    "not" TEXT NULL,
    tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BEĞENİLER
CREATE TABLE IF NOT EXISTS feed_likes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id),
    FOREIGN KEY(post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- YER İMLERİ
CREATE TABLE IF NOT EXISTS feed_bookmarks (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id),
    FOREIGN KEY(post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ANKETLER
CREATE TABLE IF NOT EXISTS feed_polls (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ANKET OYLARI
CREATE TABLE IF NOT EXISTS feed_poll_votes (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER NOT NULL,
    option_index INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(poll_id, user_id)
);

-- DM MESAJLARI
CREATE TABLE IF NOT EXISTS direct_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- BİLDİRİMLER
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    sender_id INTEGER NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    link TEXT DEFAULT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- E-OBA: OBALAR
CREATE TABLE IF NOT EXISTS obalar (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT DEFAULT NULL,
    banner_url TEXT DEFAULT NULL,
    owner_id INTEGER NOT NULL,
    is_public INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- E-OBA: DAVETLER
CREATE TABLE IF NOT EXISTS oba_invites (
    id SERIAL PRIMARY KEY,
    oba_id INTEGER NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_by INTEGER NOT NULL,
    max_uses INTEGER DEFAULT NULL,
    uses_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(oba_id) REFERENCES obalar(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- E-OBA: ROLLER
CREATE TABLE IF NOT EXISTS oba_roles (
    id SERIAL PRIMARY KEY,
    oba_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#0066ff',
    position INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    permissions TEXT DEFAULT '[]',
    FOREIGN KEY(oba_id) REFERENCES obalar(id) ON DELETE CASCADE
);

-- E-OBA: ÜYELER
CREATE TABLE IF NOT EXISTS oba_members (
    id SERIAL PRIMARY KEY,
    oba_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    nickname TEXT DEFAULT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(oba_id) REFERENCES obalar(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(oba_id, user_id)
);

-- E-OBA: ÜYE ROLLERİ
CREATE TABLE IF NOT EXISTS oba_member_roles (
    oba_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    PRIMARY KEY(oba_id, user_id, role_id),
    FOREIGN KEY(oba_id) REFERENCES obalar(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(role_id) REFERENCES oba_roles(id) ON DELETE CASCADE
);

-- E-OBA: ÇADIRLAR
CREATE TABLE IF NOT EXISTS cadirlar (
    id SERIAL PRIMARY KEY,
    oba_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(oba_id) REFERENCES obalar(id) ON DELETE CASCADE
);

-- E-OBA: MASALAR
CREATE TABLE IF NOT EXISTS masalar (
    id SERIAL PRIMARY KEY,
    cadir_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '🪑',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(cadir_id) REFERENCES cadirlar(id) ON DELETE CASCADE
);

-- E-OBA: LEVHALAR
CREATE TABLE IF NOT EXISTS levhalar (
    id SERIAL PRIMARY KEY,
    masa_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    icon TEXT DEFAULT NULL,
    config_json TEXT DEFAULT '{}',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(masa_id) REFERENCES masalar(id) ON DELETE CASCADE
);

-- E-OBA: İZİN GEÇERSİZ KILMALARI
CREATE TABLE IF NOT EXISTS permission_overrides (
    id SERIAL PRIMARY KEY,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    allow_perms TEXT DEFAULT '[]',
    deny_perms TEXT DEFAULT '[]',
    FOREIGN KEY(role_id) REFERENCES oba_roles(id) ON DELETE CASCADE,
    UNIQUE(target_type, target_id, role_id)
);

-- E-OBA: LEVHA CHAT MESAJLARI
CREATE TABLE IF NOT EXISTS levha_chat_messages (
    id SERIAL PRIMARY KEY,
    levha_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    file_url TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(levha_id) REFERENCES levhalar(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- E-OBA: LEVHA DUYURULARI
CREATE TABLE IF NOT EXISTS levha_announcements (
    id SERIAL PRIMARY KEY,
    levha_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(levha_id) REFERENCES levhalar(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- E-OBA: LEVHA TABLO SATIRLARI
CREATE TABLE IF NOT EXISTS levha_table_rows (
    id SERIAL PRIMARY KEY,
    levha_id INTEGER NOT NULL,
    row_data TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(levha_id) REFERENCES levhalar(id) ON DELETE CASCADE
);

-- E-OBA: LEVHA KANBAN KARTLARI
CREATE TABLE IF NOT EXISTS levha_kanban_cards (
    id SERIAL PRIMARY KEY,
    levha_id INTEGER NOT NULL,
    column_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT NULL,
    assigned_user_id INTEGER DEFAULT NULL,
    tag TEXT DEFAULT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(levha_id) REFERENCES levhalar(id) ON DELETE CASCADE
);

"""

# Her bir CREATE TABLE ifadesini ayrı ayrı çalıştır
for statement in tables_sql.split(';'):
    statement = statement.strip()
    if statement and 'CREATE TABLE' in statement:
        table_name = statement.split('CREATE TABLE IF NOT EXISTS ')[1].split('(')[0].strip() if 'IF NOT EXISTS' in statement else '?'
        try:
            cursor.execute(statement)
            print(f"  [OK] {table_name}")
        except Exception as e:
            print(f"  [ERROR] {table_name}: {e}")
            conn.rollback()
            continue

conn.commit()
cursor.close()
conn.close()

print("\nTum tablolar PostgreSQL'de basariyla olusturuldu!")
