\# ⬛ KARALEVHA (v2.1)



Tamamen bağımsız, modüler ve açık kaynak felsefesiyle sıfırdan inşa edilen merkezi \*\*Maker Topluluk, Üretim ve Paylaşım Platformu\*\*. 



Bu proje; maker kültürü, DIY elektroniği ve sürdürülebilir üretim teknolojilerini tek bir çatı altında toplamayı hedefler.



\---



\## 🚀 Proje Vizyonu \& Modüller



Karalevha, sadece bir web sitesi değil, maker ekosistemi için tasarlanmış entegre bir "Süper App" mimarisidir:



\- \*\*⚙️ 3D Baskı Hizmeti (v2.1):\*\* Kullanıcıların STL modellerini yükleyip anlık hacim, boyut ve maliyet analizi yapabildiği, atölye stok durumuna göre sipariş oluşturabildiği otomatik üretim motoru.

\- \*\*💬 Maker Forumu (Yakında):\*\* Teknik yardımlaşma, filament tavsiyeleri, 3D yazıcı kalibrasyonları ve donanım sorunlarının tartışılabileceği topluluk alanı.

\- \*\*📚 E-Kütüphane (Yakında):\*\* Teknik dökümanlar, filament rehberleri, açık kaynak kütüphaneler ve eğitici maker içerikleri.

\- \*\*🛠️ Proje Paylaşım Alanı (Yakında):\*\* Geliştirilen açık kaynak projelerin, STL dosyalarının ve devre şemalarının sergileneceği portfolyo havuzu.



\---



\## 🛠️ Mimari ve Teknolojik Altyapı



Proje, gelecekteki ölçeklenebilirlik gereksinimleri ve \*\*Google OAuth 2.0 (Google ile Giriş Yap)\*\* entegrasyonu göz önünde bulundurularak esnek ve modüler bir yapıda tasarlanmıştır.



\### Frontend

\- \*\*Framework:\*\* React.js

\- \*\*Yönlendirme (Routing):\*\* React Router DOM

\- \*\*3D Render Motoru:\*\* Three.js / React Three Fiber / Drei



\### Backend \& Veritabanı

\- \*\*Framework:\*\* FastAPI (Python)

\- \*\*Sunucu:\*\* Uvicorn

\- \*\*Veritabanı:\*\* SQLite

\- \*\*Güvenlik \& Şifreleme:\*\* Passlib (Bcrypt şifre hashleme motoru)



\---



\## 📂 Klasör Yapısı



```text

karalevha/

├── karalevha-backend/      # FastAPI Python Backend Servisi

│   ├── main.py             # Ana API motoru ve veritabanı şeması

│   └── karalevha.db        # Merkezi SQLite veritabanı (Git'e gönderilmez)

│

├── karalevha-frontend/     # React.js Frontend Uygulaması

│   └── karalevha-front/

│       ├── src/

│       │   ├── components/ # Navbar, Footer gibi ortak bileşenler

│       │   ├── layouts/    # Masterpage (MainLayout) şablonları

│       │   ├── views/      # Sayfalar (AnaSayfa, BaskiDukkani vb.)

│       │   ├── App.js      # URL yönlendirme merkezi

│       │   └── index.js    # Giriş noktası

