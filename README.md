# KaraLevha (v2.5)

Karalevha; açık kaynak paylaşımını temel alan, maker topluluklarını bir araya getiren ve 3D baskı hizmet analizlerini tek merkezden yöneten modern bir platform projesidir.

---

## Güncelleme Notları (Changelog)


### v2.5 - Üye Profil Sistemi (30.05.2026)
* **Admin paneli dinamik hale getirildi. 
* **Adin paneli üzerinden rol ve rozet atama sistemi getirildi.
* **Filament stoğu sistemi sıfırdan hazırlandı.

### v2.4 - Üye Profil Sistemi (30.05.2026)
* **Sosyal Profil Yönetimi:** Kullanıcıların kendilerini tanıtabileceği Biyografi (`bio`), portfolyo/sosyal medya ekleyebileceği Özel Link (`custom_link`) ve platformdaki dijital kimliğini yansıtan Profil Resmi (PP) yükleme motoru arayüze (`uye.js`) entegre edildi.
* **Gelişmiş Rol & Yetki Sistemi:** Kullanıcılar için merkezi ünvan rozeti (`badge`) altyapısı kuruldu; ilk kayıt olanlara otomatik `Maker` rozeti atanarak gelecekteki moderasyon ve yetkilendirme süreçlerine zemin hazırlandı.

### v2.3 - Forum Güncellemesi (30.05.2026)
* **Görsel & Medya Yükleme Motoru:** FastAPI ve `StaticFiles` entegrasyonuyla sunucu tabanlı dosya depolama sistemi kuruldu; forum konularına görsel/fotoğraf ekleme desteği arayüze entegre edildi.
* **İç İçe Cevap Sistemi (Nested Replies):** Yorumlar tablosuna hiyerarşik bağımlılık (`parent_id`) eklenerek, makerların diğer kullanıcıların yorumlarına doğrudan girintili (nested) alt cevaplar yazabileceği gelişmiş tartışma yapısı devreye alındı.
* **Canlı Akış & Önizleme Algoritması:** Forum ana sayfasında gezen kullanıcıların konuya tıklamadan fikir sahibi olabilmesi için, her gönderi kartının altında o konuya ait ilk 3 ana yorumu basan asenkron önizleme motoru eklendi.
* **Mimarî Optimizasyon:** Arka planda çakışmaya sebep olan mükerrer endpoint fonksiyonları ayıklandı; SQL sorguları ve veri okuma süreçleri refaktör edilerek performans artırıldı.

###  v2.2 - Baskı Torbacısı Entegrasyon ve Arayüz Güncellemesi (29.05.2026)
* **Merkezi Üyelik Sistemi:** Kullanıcıların tüm platformda (Forum, Baskı Dükkanı vb.) ortak kullanabileceği FastAPI & SQLite destekli güvenli Kayıt Ol (`kayit.js`) ve Giriş Yap (`giris.js`) sayfaları arayüze entegre edildi.
* **Ana Sayfa Arayüzü:** Platformun vitrini, orijinal şablonundaki saf siyah tema ve ikonik üçlü blok düzenine göre ile yeniden inşa edildi.
* **Dinamik STL Analiz Motoru:** 3D Baskı Dükkanı'ndaki sabit "25 gram hatası" düzeltilerek, yüklenen gerçek STL dosyalarının milimetrik hacim ve boyut analizini yapan dinamik motor devreye alındı.
* **React Router Köprüsü:** Sayfalar arası pürüzsüz ve yenilenmeyen geçişler için sayfa yönlendirme altyapısı kuruldu. 

###  v2.1 - Yeniden İnşa & Altyapı Taşınması 
* Projenin bulut tabanlı sürümü ve yerel kütüphaneleri optimize edilerek modern React (Frontend) ve FastAPI (Backend) mimarisine geçiş süreci resmen başladı.
* Veritabanı şemaları (Kullanıcılar ve Filamentler) SQLite üzerinde merkezi hale getirildi.

---

