from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import sqlite3

social_router = APIRouter(prefix="/api", tags=["Sosyal & DM & Bildirimler"])
DB_NAME = "karalevha.db"

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def social_veritabani_hazirla():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Birebir Özel Mesajlar (DM) Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS direct_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # 2. Bildirimler Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            sender_id INTEGER NULL,
            type TEXT NOT NULL, -- 'dm', 'forum', 'oba', 'system'
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            link TEXT DEFAULT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # İndeksler (Sorgu Hızı İçin)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_dm_users ON direct_messages(sender_id, receiver_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read)")

    conn.commit()
    conn.close()

# ----------------- PYDANTIC MODELLERİ -----------------

class DMSendModel(BaseModel):
    sender_id: int
    receiver_id: int
    message: str

class MarkReadModel(BaseModel):
    user_id: int

# ----------------- DM ENDPOINT'LERİ -----------------

@social_router.get("/dm/conversations")
def get_conversations(user_id: int = Query(...)):
    """Kullanıcının aktif DM sohbet partnerlerini ve son mesajları döner."""
    conn = get_db()
    cursor = conn.cursor()

    # Kullanıcının mesajlaştığı tüm diğer tekil kullanıcıları bul
    partner_rows = cursor.execute('''
        SELECT DISTINCT
            CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as partner_id
        FROM direct_messages
        WHERE sender_id = ? OR receiver_id = ?
    ''', (user_id, user_id, user_id)).fetchall()

    conversations = []
    for p in partner_rows:
        pid = p["partner_id"]
        partner = cursor.execute("SELECT id, display_name, profile_image, badge FROM users WHERE id = ?", (pid,)).fetchone()
        if not partner:
            continue

        # Son mesajı al
        last_msg = cursor.execute('''
            SELECT message, created_at, sender_id, is_read
            FROM direct_messages
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at DESC LIMIT 1
        ''', (user_id, pid, pid, user_id)).fetchone()

        # Okunmamış mesaj sayısı
        unread_count = cursor.execute('''
            SELECT COUNT(*) FROM direct_messages
            WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
        ''', (pid, user_id)).fetchone()[0]

        conversations.append({
            "partner_id": partner["id"],
            "display_name": partner["display_name"],
            "profile_image": partner["profile_image"],
            "badge": partner["badge"],
            "last_message": last_msg["message"] if last_msg else "",
            "last_message_time": last_msg["created_at"] if last_msg else "",
            "last_sender_id": last_msg["sender_id"] if last_msg else None,
            "unread_count": unread_count
        })

    # Son mesaja göre sırala
    conversations.sort(key=lambda x: x["last_message_time"], reverse=True)
    conn.close()
    return conversations


@social_router.get("/dm/messages")
def get_messages(user_id: int = Query(...), partner_id: int = Query(...)):
    """İki kullanıcı arasındaki mesaj geçmişini döner ve okunmamışları okundu işaretler."""
    conn = get_db()
    cursor = conn.cursor()

    rows = cursor.execute('''
        SELECT dm.*, u.display_name as sender_name, u.profile_image as sender_avatar
        FROM direct_messages dm
        JOIN users u ON dm.sender_id = u.id
        WHERE (dm.sender_id = ? AND dm.receiver_id = ?) OR (dm.sender_id = ? AND dm.receiver_id = ?)
        ORDER BY dm.created_at ASC
    ''', (user_id, partner_id, partner_id, user_id)).fetchall()

    # Karşıdan gelen okunmamış mesajları okundu yap
    cursor.execute('''
        UPDATE direct_messages SET is_read = 1
        WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
    ''', (partner_id, user_id))

    # İlgili DM bildirimlerini de okundu yap
    cursor.execute('''
        UPDATE notifications SET is_read = 1
        WHERE user_id = ? AND sender_id = ? AND type = 'dm'
    ''', (user_id, partner_id))

    conn.commit()
    conn.close()
    return [dict(r) for r in rows]


@social_router.post("/dm/send")
def send_message(payload: DMSendModel):
    """Yeni DM gönderir ve alıcı için bildirim oluşturur."""
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Mesaj boş olamaz")

    conn = get_db()
    cursor = conn.cursor()

    # Gönderen ve alıcıyı doğrula
    sender = cursor.execute("SELECT display_name, profile_image FROM users WHERE id = ?", (payload.sender_id,)).fetchone()
    receiver = cursor.execute("SELECT id FROM users WHERE id = ?", (payload.receiver_id,)).fetchone()
    if not sender or not receiver:
        conn.close()
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    # 1. Mesajı Kaydet
    cursor.execute('''
        INSERT INTO direct_messages (sender_id, receiver_id, message, is_read)
        VALUES (?, ?, ?, 0)
    ''', (payload.sender_id, payload.receiver_id, payload.message.strip()))
    msg_id = cursor.lastrowid

    # 2. Alıcıya Bildirim Oluştur
    short_content = (payload.message[:60] + "...") if len(payload.message) > 60 else payload.message
    cursor.execute('''
        INSERT INTO notifications (user_id, sender_id, type, title, content, link)
        VALUES (?, ?, 'dm', ?, ?, ?)
    ''', (
        payload.receiver_id,
        payload.sender_id,
        f"💬 {sender['display_name']} sana özel mesaj gönderdi",
        short_content,
        f"/mesajlar?partner={payload.sender_id}"
    ))

    conn.commit()
    conn.close()
    return {"status": "success", "message_id": msg_id}


@social_router.get("/dm/unread_count")
def get_unread_dm_count(user_id: int = Query(...)):
    """Kullanıcının toplam okunmamış DM sayısını döner."""
    conn = get_db()
    cursor = conn.cursor()
    cnt = cursor.execute("SELECT COUNT(*) FROM direct_messages WHERE receiver_id = ? AND is_read = 0", (user_id,)).fetchone()[0]
    conn.close()
    return {"unread_count": cnt}


# ----------------- BİLDİRİM ENDPOINT'LERİ -----------------

@social_router.get("/notifications")
def get_notifications(user_id: int = Query(...)):
    """Kullanıcının bildirimlerini son 30 bildirim olarak listeler."""
    conn = get_db()
    cursor = conn.cursor()

    rows = cursor.execute('''
        SELECT n.*, u.display_name as sender_name, u.profile_image as sender_avatar
        FROM notifications n
        LEFT JOIN users u ON n.sender_id = u.id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT 30
    ''', (user_id,)).fetchall()

    conn.close()
    return [dict(r) for r in rows]


@social_router.get("/notifications/unread_count")
def get_unread_notification_count(user_id: int = Query(...)):
    """Okunmamış bildirim sayısını döner."""
    conn = get_db()
    cursor = conn.cursor()
    cnt = cursor.execute("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0", (user_id,)).fetchone()[0]
    conn.close()
    return {"unread_count": cnt}


@social_router.post("/notifications/mark_all_read")
def mark_all_notifications_read(payload: MarkReadModel):
    """Kullanıcının tüm bildirimlerini okundu işaretler."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (payload.user_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@social_router.post("/notifications/read/{notification_id}")
def mark_notification_read(notification_id: int):
    """Tek bir bildirimi okundu işaretler."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notification_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@social_router.delete("/notifications/{notification_id}")
def delete_notification(notification_id: int):
    """Bildirimi siler."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM notifications WHERE id = ?", (notification_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


# ----------------- KULLANICI ARAMA (YENİ SOHBET BAŞLATMAK İÇİN) -----------------

@social_router.get("/users/search")
def search_users(q: str = Query("", min_length=1), current_user_id: Optional[int] = Query(None)):
    """Yeni sohbet başlatmak veya etiketlemek için kullanıcı arar."""
    conn = get_db()
    cursor = conn.cursor()
    query = f"%{q.strip()}%"

    if current_user_id:
        rows = cursor.execute('''
            SELECT id, display_name, email, profile_image, badge
            FROM users
            WHERE (display_name LIKE ? OR email LIKE ?) AND id != ?
            LIMIT 15
        ''', (query, query, current_user_id)).fetchall()
    else:
        rows = cursor.execute('''
            SELECT id, display_name, email, profile_image, badge
            FROM users
            WHERE display_name LIKE ? OR email LIKE ?
            LIMIT 15
        ''', (query, query)).fetchall()

    conn.close()
    return [dict(r) for r in rows]
