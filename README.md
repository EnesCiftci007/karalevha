# KaraLevha (v2.2)

Karalevha; açık kaynak paylaşımını temel alan, maker topluluklarını bir araya getiren ve 3D baskı hizmet analizlerini tek merkezden yöneten modern bir platform projesidir.

---

## Güncelleme Notları (Changelog)

###  v2.2 - Büyük Entegrasyon & Arayüz Güncellemesi (29.05.2026)
* **Merkezi Üyelik Sistemi:** Kullanıcıların tüm platformda (Forum, Baskı Dükkanı vb.) ortak kullanabileceği FastAPI & SQLite destekli güvenli Kayıt Ol (`kayit.js`) ve Giriş Yap (`giris.js`) sayfaları arayüze entegre edildi.
* **Ana Sayfa Arayüzü:** Platformun vitrini, orijinal şablonundaki saf siyah tema ve ikonik üçlü blok (Baskı Dükkanı, E-Kütüphane, Forum) düzenine göre React bileşenleri ile yeniden inşa edildi.
* **Dinamik STL Analiz Motoru:** 3D Baskı Dükkanı'ndaki sabit 25 gram taklit (mock) veri yapısı çöpe atıldı; yerine backend tarafında `numpy-stl` entegrasyonu yapılarak yüklenen gerçek STL dosyalarının milimetrik hacim ve boyut analizini yapan dinamik motor devreye alındı.
* **React Router Köprüsü:** Sayfalar arası pürüzsüz ve yenilenmeyen geçişler için sayfa yönlendirme altyapısı kuruldu. 

###  v2.1 - Yeniden İnşa & Altyapı Taşınması
* Projenin bulut tabanlı sürümü ve yerel kütüphaneleri optimize edilerek modern React (Frontend) ve FastAPI (Backend) mimarisine geçiş süreci resmen başladı.
* Veritabanı şemaları (Kullanıcılar ve Filamentler) SQLite üzerinde merkezi hale getirildi.

---

## 🛠️ Kullanılan Teknolojiler

* **Frontend:** React.js, React Router DOM, Inline CSS (Karanlık Tema)
* **Backend:** Python, FastAPI, Uvicorn, SQLite3, CryptContext (Bcrypt)
* **Analiz Motoru:** `numpy-stl`, `tempfile`