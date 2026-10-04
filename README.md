# Karalevha V2

Karalevha, dijital toplulukların (Obalar), 3B baskı projelerinin ve açık kaynaklı projelerin paylaşıldığı modern bir platformdur.

## 🚀 Teknolojiler
- **Backend:** .NET 8 (C#), Entity Framework Core, PostgreSQL, JWT Authentication
- **Frontend:** React 19, TypeScript, Vite, TailwindCSS, Three.js (3B STL Önizleme)

## 📁 Proje Yapısı
- `/Karalevha.API` - C# Backend klasörü (REST API, Veritabanı Modelleri)
- `/karalevha-client` - React + TypeScript Frontend klasörü

## ⚙️ Kurulum ve Çalıştırma

### Backend (API)
1. `Karalevha.API` dizinine gidin.
2. `appsettings.example.json` dosyasını kopyalayarak `appsettings.json` oluşturun ve veritabanı ayarlarınızı (PostgreSQL) girin.
3. EF Core araçlarıyla veritabanını güncelleyin: `dotnet ef database update`
4. Projeyi çalıştırın: `dotnet run` (Varsayılan olarak http://localhost:5114 portunda çalışır)

### Frontend (Client)
1. `karalevha-client` dizinine gidin.
2. Bağımlılıkları yükleyin: `npm install`
3. Geliştirme sunucusunu başlatın: `npm run dev`
