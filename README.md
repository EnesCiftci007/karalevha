# Karalevha

Karalevha, dijital toplulukların (Obalar), 3B baskı projelerinin ve açık kaynaklı projelerin paylaşıldığı modern bir platformdur.

## Teknolojiler
- **Backend:** .NET 9 (C#), Entity Framework Core, PostgreSQL, SignalR, JWT Authentication, BCrypt
- **Frontend:** React 19, TypeScript, Vite, TailwindCSS, Three.js, React Context

## Proje Yapısı
- `/Karalevha.API` - C# Backend klasörü (REST API, WebSocket, Veritabanı Modelleri)
- `/karalevha-client` - React + TypeScript Frontend klasörü

## Kurulum ve Çalıştırma (Yerel Geliştirme)

### Backend (API)
Proje .NET 9 kullanmaktadır. Veritabanı olarak PostgreSQL gereklidir.

1. `Karalevha.API` dizinine gidin.
2. Kullanıcı sırlarını (User Secrets) ayarlayın:
```bash
dotnet user-secrets init
dotnet user-secrets set "Jwt:Key" "GIZLI_VE_EN_AZ_32_KARAKTER_UZUNLUGUNDA_BIR_SIFRE_YAZIN"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Database=karalevha;Username=postgres;Password=postgres"
```
3. EF Core araçlarıyla veritabanını güncelleyin: `dotnet ef database update`
4. Projeyi çalıştırın: `dotnet run` (Varsayılan olarak http://localhost:5114 portunda çalışır)

### Frontend (Client)
Node.js (v18+) gereklidir.
1. `karalevha-client` dizinine gidin.
2. Bağımlılıkları yükleyin: `npm install`
3. Geliştirme sunucusunu başlatın: `npm run dev`

## Canlı Yayına Alma (Deployment)

Karalevha monolitik olarak canlıya çıkmaya hazırdır.

**Frontend (Vercel):**
- Projeyi Vercel'e bağlayıp `karalevha-client` klasörünü Root Directory olarak seçin.
- Build command: `npm run build`
- Output klasörü: `dist`
- Environment Variables: `VITE_API_URL` (Backend URL'niz)

**Backend (Render.com / Docker vb.):**
- Dockerfile yardımıyla veya doğrudan yayınlayın.
- Environment Variables:
  - `Jwt__Key`
  - `ConnectionStrings__DefaultConnection`
  - `Cors__Origins__0` (Frontend Vercel URL'niz)
  - `ASPNETCORE_ENVIRONMENT` = `Production`

## Güvenlik Altyapısı
Proje aşağıdaki temel güvenlik adımlarını içermektedir:
- Özel Oba mesajları ve odaları SignalR ve REST API seviyesinde yetkisiz erişime kapalıdır.
- Oba şifreleri BCrypt ile hashlenerek korunur.
- Eş zamanlı (Concurrency) işlemler Veritabanı Unique Constraint'leri ve EF Core Transaction'ları ile kontrol altındadır.
- STL dosya yüklemeleri boyut ve Path Traversal güvenlikleri ile kısıtlanmıştır.
- Akış ve Mesaj geçmişleri Pagination mantığı ile işlenmektedir.
- Özel Oba girişlerinde (Brute-Force engellemek için) Request Rate Limiting devrededir.

## Önemli Not (Placeholders)
- Projeler sayfasındaki **Yıldız** ve **Fork** butonları ile Akış'taki **Beğen/Yorum/Paylaş** etkileşimleri şu aşamada salt UI Placeholder'dır (Görseldir) ve henüz gerçek entegrasyonu bulunmamaktadır.

