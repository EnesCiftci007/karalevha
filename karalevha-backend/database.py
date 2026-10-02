"""
KaraLevha - Veritabanı Bağlantı Katmanı
========================================
DATABASE_URL ortam değişkeni varsa PostgreSQL'e,
yoksa yerel SQLite'a bağlanır.

Kullanım:
    from database import get_db, init_db
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (1,))
    rows = cursor.fetchall()
    conn.close()
"""

import os
import sqlite3

# .env dosyasından DATABASE_URL'yi oku
def _load_env():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())

_load_env()

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# PostgreSQL bağlantısı gerekiyorsa psycopg2 import et
if DATABASE_URL:
    import psycopg2
    import psycopg2.extras
    print(f"[DB] PostgreSQL moduna geçildi: ...{DATABASE_URL[-30:]}")
else:
    print("[DB] SQLite modu aktif (karalevha.db)")


class SqliteDictRow:
    """
    sqlite3.Row'u dict gibi davrandırır.
    Hem row["key"] hem de row[0] çalışır.
    """
    def __init__(self, d):
        self._d = dict(d)
        self._keys = list(self._d.keys())
        self._values = list(self._d.values())
        
    def __getitem__(self, key):
        if isinstance(key, int):
            return self._values[key]
        return self._d[key]
        
    def keys(self):
        return self._d.keys()
        
    def values(self):
        return self._d.values()
        
    def items(self):
        return self._d.items()
        
    def __contains__(self, key):
        return key in self._d

    def __iter__(self):
        return iter(self._keys)

class PgCursorWrapper:
    """
    psycopg2 cursor'ünü sqlite3 cursor gibi davrandırır.
    - '?' placeholder'larını '%s' ile değiştirir
    - Sonuçları dict-benzeri erişime uygun döndürür
    """
    def __init__(self, pg_cursor):
        self._cursor = pg_cursor
        self.lastrowid = None
        self.description = None

    def execute(self, query, params=None):
        # SQLite '?' → PostgreSQL '%s'
        query = query.replace("?", "%s")
        
        # SQLite INSERT OR IGNORE → PostgreSQL ON CONFLICT DO NOTHING
        if "INSERT OR IGNORE" in query.upper():
            # Sadece ilk geçişi değiştir, query'nin sonuna ekle
            query = query.replace("INSERT OR IGNORE", "INSERT", 1)
            query = query.rstrip(";") + " ON CONFLICT DO NOTHING"
        
        # SQLite AUTOINCREMENT → PostgreSQL GENERATED ALWAYS / SERIAL
        # CREATE TABLE ifadelerinde otomatik çeviri
        if "CREATE TABLE" in query.upper():
            query = query.replace("AUTOINCREMENT", "")
            query = query.replace("INTEGER PRIMARY KEY", "SERIAL PRIMARY KEY")
        
        # INSERT sonrası lastrowid almak için (hack)
        is_insert = query.strip().upper().startswith("INSERT")
        
        if is_insert:
            # PostgreSQL'de lastrowid doğrudan yoktur, RETURNING id kullanmalıyız.
            query_returning = query.rstrip(";") + " RETURNING id"
            try:
                # Olası bir hatada tüm transaction'ın çökmesini önlemek için Savepoint oluştur
                self._cursor.execute("SAVEPOINT lastrowid_sp")
                
                # Önce RETURNING id ile deniyoruz
                if params:
                    self._cursor.execute(query_returning, params)
                else:
                    self._cursor.execute(query_returning)
                
                row = self._cursor.fetchone()
                if row and 'id' in row:
                    self.lastrowid = row['id']
                    
                self._cursor.execute("RELEASE SAVEPOINT lastrowid_sp")
            except psycopg2.errors.UndefinedColumn:
                # Tabloda 'id' sütunu yoksa (join tablosu vb.), hata alırız.
                # Sadece bu savepoint'e dön (diğer başarılı insertleri silme!)
                self._cursor.execute("ROLLBACK TO SAVEPOINT lastrowid_sp")
                if params:
                    self._cursor.execute(query, params)
                else:
                    self._cursor.execute(query)
                self.lastrowid = None
            
            self.description = self._cursor.description
            return self
        else:
            if params:
                self._cursor.execute(query, params)
            else:
                self._cursor.execute(query)
            self.description = self._cursor.description
            return self

    def fetchone(self):
        row = self._cursor.fetchone()
        return SqliteDictRow(row) if row else None

    def fetchall(self):
        rows = self._cursor.fetchall()
        return [SqliteDictRow(row) for row in rows]
    
    def fetchmany(self, size=None):
        rows = self._cursor.fetchmany(size) if size else self._cursor.fetchmany()
        return [SqliteDictRow(row) for row in rows]


class PgConnectionWrapper:
    """
    psycopg2 bağlantısını sqlite3.Connection gibi davrandırır.
    - row_factory desteği (uyumluluk için, zaten RealDictCursor kullanıyoruz)
    - commit, close, cursor metotları
    """
    def __init__(self, pg_conn):
        self._conn = pg_conn
        self.row_factory = None  # SQLite uyumluluğu için

    def cursor(self):
        pg_cursor = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        return PgCursorWrapper(pg_cursor)

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()

    def execute(self, query, params=None):
        cursor = self.cursor()
        cursor.execute(query, params)
        return cursor




def get_db():
    """
    Veritabanı bağlantısı döndürür.
    DATABASE_URL varsa → PostgreSQL
    DATABASE_URL yoksa → SQLite (karalevha.db)
    """
    if DATABASE_URL:
        conn = psycopg2.connect(DATABASE_URL)
        return PgConnectionWrapper(conn)
    else:
        conn = sqlite3.connect("karalevha.db")
        conn.row_factory = sqlite3.Row
        return conn


def get_raw_db():
    """
    Ham veritabanı bağlantısı (row_factory olmadan).
    Sadece DDL işlemleri için kullanılır.
    """
    if DATABASE_URL:
        conn = psycopg2.connect(DATABASE_URL)
        return PgConnectionWrapper(conn)
    else:
        conn = sqlite3.connect("karalevha.db")
        return conn


DB_NAME = "karalevha.db"  # Geriye uyumluluk için

# IntegrityError ve OperationalError'u her iki driver'dan da export et
if DATABASE_URL:
    IntegrityError = psycopg2.IntegrityError
    OperationalError = psycopg2.OperationalError
else:
    IntegrityError = sqlite3.IntegrityError
    OperationalError = sqlite3.OperationalError

