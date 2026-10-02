import os
import json
import random
import uuid
from datetime import datetime, timedelta
import bcrypt
from database import get_db

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def seed_db():
    print("Demo verileri yükleniyor...")
    
    conn = get_db()
    cursor = conn.cursor()

    # Idempotency check
    try:
        cursor.execute("SELECT COUNT(*) FROM users")
        row = cursor.fetchone()
        user_count = row[0] if isinstance(row, (list, tuple)) else list(row.values())[0]
        if user_count >= 10:
            print("Veritabanında zaten en az 10 kullanıcı mevcut (Idempotency). İşlem atlandı.")
            conn.close()
            return
    except Exception:
        print("Tablolar bulunamadı, lütfen önce veritabanını oluşturun (örn. backend uygulamasını çalıştırarak).")
        conn.close()
        return

    # Demo users
    users_data = [
        ("ahmet.yilmaz@karalevha.demo", "Ahmet Yılmaz", "admin", "Admin", "Kurucu ve baş mühendis."),
        ("zeynep.kaya@karalevha.demo", "Zeynep Kaya", "admin", "Mod", "Topluluk yöneticisi, 3D tasarım aşığı."),
        ("mert.demir@karalevha.demo", "Mert Demir", "user", "Maker", "Voron kullanıcısı, her şeyi modifiye etmeyi sever."),
        ("ayse.celik@karalevha.demo", "Ayşe Çelik", "user", "Mühendis", "Mekatronik mühendisi, robotik projeler yapıyor."),
        ("can.ozkan@karalevha.demo", "Can Özkan", "user", "Tasarımcı", "Endüstriyel tasarımcı, ergonomik tasarımlar üzerine çalışıyor."),
        ("elif.sahin@karalevha.demo", "Elif Şahin", "user", "Maker", "Cosplay prop üreticisi, boyama ve ardıl işlemler uzmanı."),
        ("burak.yildiz@karalevha.demo", "Burak Yıldız", "user", "Mühendis", "Elektronik devre tasarımı ve Klipper yapılandırmaları onun işi."),
        ("kemal.turan@karalevha.demo", "Kemal Turan", "user", "Maker", "Eski püskü yazıcıları hayata döndürüyor."),
        ("ceren.aydin@karalevha.demo", "Ceren Aydın", "user", "Tasarımcı", "Organik modelleme ve figür tasarımı ile ilgileniyor."),
        ("onur.koc@karalevha.demo", "Onur Koç", "user", "Maker", "RC araçlar ve drone parçaları basıyor.")
    ]

    password_hash = hash_password("Demo1234!")
    user_ids = []

    for i, user in enumerate(users_data):
        email, display_name, role, badge, bio = user
        created_at = (datetime.now() - timedelta(days=random.randint(30, 365))).isoformat()
        cursor.execute("""
            INSERT INTO users (email, password_hash, auth_provider, display_name, role, profile_image, bio, custom_link, badge, kayit_tarihi)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (email, password_hash, "local", display_name, role, None, bio, None, badge, created_at))
        user_ids.append(cursor.lastrowid)

    # Filaments
    filaments = [
        ("PLA", "Siyah", "#000000", 1),
        ("PLA", "Beyaz", "#FFFFFF", 1),
        ("PLA", "Kırmızı", "#FF0000", 1),
        ("PLA+", "Mavi", "#0000FF", 1),
        ("PETG", "Siyah", "#000000", 1),
        ("PETG", "Saydam", "#FFFFFF", 1),
        ("ABS", "Gri", "#808080", 1),
        ("TPU", "Siyah", "#000000", 1),
    ]
    cursor.execute("SELECT COUNT(*) FROM filaments")
    if cursor.fetchone()[0] == 0:
        for f_type, c_name, c_hex, active in filaments:
            cursor.execute("""
                INSERT INTO filaments (id, type, "colorName", "colorHex", active)
                VALUES (?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), f_type, c_name, c_hex, active))

    # Obas
    cursor.execute("SELECT COUNT(*) FROM obalar")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO obalar (id, name, description, avatar_url, banner_url, owner_id, is_public)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (1, "Ana Oba", "Herkesin toplandığı ana oba.", None, None, user_ids[0], 1))
    
    # Oba members
    for uid in user_ids:
        cursor.execute("INSERT OR IGNORE INTO oba_members (oba_id, user_id, joined_at) VALUES (?, ?, ?)", 
                       (1, uid, datetime.now().isoformat()))

    # Cents, Tables, Boards (hierarchy for Oba)
    cursor.execute("SELECT COUNT(*) FROM cadirlar")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO cadirlar (id, oba_id, name) VALUES (?, ?, ?)", (1, 1, "Genel Çadır"))
        cursor.execute("INSERT INTO masalar (id, cadir_id, name) VALUES (?, ?, ?)", (1, 1, "Sohbet Masası"))
        cursor.execute("INSERT INTO levhalar (id, masa_id, title, type) VALUES (?, ?, ?, ?)", (1, 1, "Ana Pano", "chat"))

    # Kanban & Chat
    for i in range(5):
        cursor.execute("""
            INSERT INTO levha_chat_messages (levha_id, user_id, content, created_at)
            VALUES (?, ?, ?, ?)
        """, (1, random.choice(user_ids), f"Merhaba oba sakinleri! Deneme mesajı {i+1}", datetime.now().isoformat()))

    columns = ["To Do", "In Progress", "Done"]
    for i in range(5):
        cursor.execute("""
            INSERT INTO levha_kanban_cards (levha_id, column_name, title, description, tag, assigned_user_id, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (1, random.choice(columns), f"Proje Görevi {i+1}", "Örnek kanban kartı açıklaması...", "Bug", random.choice(user_ids), i))

    # Posts
    post_topics = [
        "Voron 2.4 toplama sürecim",
        "Klipper için en iyi makrolar",
        "PLA vs PETG: Hangisini ne zaman kullanmalı?",
        "Yeni tasarladığım kulaklık standı STL yayında!",
        "Ender 3 v2 anakart güncelleme rehberi",
        "CoreXY sistemlerde belt tension nasıl ayarlanır?",
        "Kurutucu kutusu (Drybox) yapımı için parça listesi",
        "3D yazıcı ile yapılan en garip şeyler",
        "Bambu Lab X1C deneyimlerim",
        "OctoPrint eklentileri önerisi",
        "Destek (support) ayarları için ipuçları",
        "Nozzle tıkanıklığı nasıl giderilir?",
        "Z-wobble sorunu çözümüm",
        "Bed leveling için BLTouch mı CRTouch mı?",
        "Üç boyutlu modelleme için Fusion 360 vs Blender",
        "Reçine (Resin) yazıcılara giriş",
        "Esnek filament (TPU) yazdırma zorlukları",
        "PLA atıklarını geri dönüştürme fikri",
        "Makine yataklamasında linear rail vs v-slot tekerlek",
        "Yeni başlayanlar için dilimleyici (Slicer) önerileri",
        "Yazıcı kabini (Enclosure) yapmanın faydaları",
        "Masaüstü CNC dönüşümü yapan var mı?",
        "Klipper input shaper testi sonuçlarım",
        "Vazo modu ile harika baskılar",
        "3D yazıcı güvenliği: Termal runaway koruması!"
    ]
    
    # Forum categories
    cursor.execute("SELECT COUNT(*) FROM forum_categories")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO forum_categories (id, name, description) VALUES (?, ?, ?)", (1, "Genel Sohbet", "Her şey hakkında konuşun."))

    post_ids = []
    poll_posts = random.sample(range(25), 3)

    total_comments = 0
    total_likes = 0

    for idx, topic in enumerate(post_topics):
        uid = random.choice(user_ids)
        content = f"{topic} konusunda deneyimlerimi paylaşıyorum. Siz ne düşünüyorsunuz? Parça kalitesi ve dayanıklılık konusunda gerçekten fark ediyor."
        tarih = (datetime.now() - timedelta(days=random.randint(1, 30), hours=random.randint(1, 24))).isoformat()
        
        cursor.execute("""
            INSERT INTO forum_posts (category_id, user_id, title, content, image_url, images, repost_of_id, tarih)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (1, uid, topic, content, None, "[]", None, tarih))
        post_id = cursor.lastrowid
        post_ids.append(post_id)

        # Likes
        num_likes = random.randint(0, 8)
        total_likes += num_likes
        likers = random.sample(user_ids, num_likes)
        for liker in likers:
            cursor.execute("""
                INSERT INTO feed_likes (post_id, user_id, tarih)
                VALUES (?, ?, ?)
            """, (post_id, liker, datetime.now().isoformat()))
            
        # Comments
        num_comments = random.randint(0, 5)
        total_comments += num_comments
        for _ in range(num_comments):
            c_uid = random.choice(user_ids)
            cursor.execute("""
                INSERT INTO forum_comments (post_id, user_id, content, parent_id, image_url, tarih)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (post_id, c_uid, "Harika bir paylaşım, ellerine sağlık. Kesinlikle deneyeceğim!", None, None, datetime.now().isoformat()))

        # Polls
        if idx in poll_posts:
            options = json.dumps(["Kesinlikle Katılıyorum", "Kısmen Katılıyorum", "Fikrim Yok"])
            cursor.execute("""
                INSERT INTO feed_polls (post_id, question, options, tarih)
                VALUES (?, ?, ?, ?)
            """, (post_id, "Bu konudaki genel kanı nedir?", options, datetime.now().isoformat()))
            poll_id = cursor.lastrowid

            num_votes = random.randint(3, 10)
            voters = random.sample(user_ids, min(num_votes, len(user_ids)))
            for voter in voters:
                opt_idx = random.randint(0, 2)
                cursor.execute("""
                    INSERT INTO feed_poll_votes (poll_id, option_index, user_id, tarih)
                    VALUES (?, ?, ?, ?)
                """, (poll_id, opt_idx, voter, datetime.now().isoformat()))

    # Print Orders
    durumlar = ["Sipariş Alındı", "Hazırlanıyor", "Kargoya Verildi", "Teslim Edildi", "İptal Edildi"]
    for i in range(5):
        uid = random.choice(user_ids)
        sepet = json.dumps([{"isim": "Baskı Parçası", "fiyat": 50, "adet": 2}])
        durum = durumlar[i]
        
        # 'not' keyword olabileceğinden "not" şeklinde veya es geçilebilir, gereksinimlerde opsiyonel görünüyor.
        # "not" sütununu boş bırakıyorum.
        cursor.execute("""
            INSERT INTO print_orders (user_id, isim, telefon, eposta, adres, teslimat_yontemi, toplam_fiyat, sepet_icerigi, durum, iletisim_tercihi, tarih)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (uid, f"Müşteri {i+1}", "5551234567", f"musteri{i+1}@test.com", "Test Adres, İstanbul", "Kargo", 100.0, sepet, durum, "Email", datetime.now().isoformat()))

    conn.commit()
    conn.close()

    print(f"Başarıyla eklendi: 10 Kullanıcı, {len(post_topics)} Post, {total_comments} Yorum, {total_likes} Beğeni, 5 Sipariş, 8 Filament.")

if __name__ == "__main__":
    seed_db()
