# Karalevha V2

Karalevha, dijital toplulukların (Obalar), 3B baskı projelerinin ve açık kaynaklı projelerin paylaşıldığı modern bir platformdur.

## 🚀 Teknolojiler
- **Backend:** .NET 9 (C#), Entity Framework Core, PostgreSQL, SignalR, JWT Authentication
- **Frontend:** React 19, TypeScript, Vite, TailwindCSS, Three.js (3B STL Önizleme), pdf.js (PDF Önizleme)

## 📁 Proje Yapısı
- `/Karalevha.API` - C# Backend klasörü (REST API, Veritabanı Modelleri)
- `/karalevha-client` - React + TypeScript Frontend klasörü
- `/scripts` - Yerel geliştirme yardımcıları (veritabanını başlat/durdur)

## ⚙️ Kurulum ve Çalıştırma (Yerel Geliştirme)

### 1. Yerel veritabanı (PostgreSQL)

Geliştirme ortamı Render'daki veritabanını değil, bilgisayarınızdaki PostgreSQL'i kullanır.
[PostgreSQL](https://www.postgresql.org/download/windows/) kurulu olmalıdır (17 ile denendi).

Veritabanı kümesi yönetici yetkisi gerektirmeyen bir kullanıcı klasöründe durur
(`%LOCALAPPDATA%\Karalevha\pgdata`); bilerek OneDrive/depo dışındadır. Sunucu **5433** portunda çalışır,
böylece bilgisayardaki başka PostgreSQL kurulumlarıyla (5432) çakışmaz.

İlk kurulum (bir kere):

```powershell
$bin  = "C:\Program Files\PostgreSQL\17\bin"
$data = "$env:LOCALAPPDATA\Karalevha\pgdata"
& "$bin\initdb.exe" -D $data -U postgres -W -E UTF8 --locale=C --locale-provider=builtin --builtin-locale=C.UTF-8 -A scram-sha-256
Add-Content "$data\postgresql.conf" "port = 5433"
.\scripts\db-start.ps1
& "$bin\createdb.exe" -h localhost -p 5433 -U postgres -E UTF8 karalevha
```

Sonraki her seferde (bilgisayar yeniden başladığında sunucu kendiliğinden açılmaz):

```powershell
.\scripts\db-start.ps1   # başlat
.\scripts\db-stop.ps1    # durdur
```

### 2. Backend (API)

Gizli ayarlar depoya girmez; `dotnet user-secrets` ile tutulur. `Karalevha.API` dizininde:

```bash
dotnet user-secrets set "Jwt:Key" "GIZLI_VE_EN_AZ_32_KARAKTER_UZUNLUGUNDA_BIR_SIFRE_YAZIN"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5433;Database=karalevha;Username=postgres;Password=sifreniz"
dotnet run
```

API http://localhost:5114 adresinde açılır. Tablolar (migration'lar) açılışta otomatik uygulanır.

### 3. Frontend (Client)

```bash
cd karalevha-client
npm install
npm run dev
```

Site http://localhost:5173 adresinde açılır. Farklı bir API adresi için `VITE_API_URL` tanımlayın.

## 👀 Giriş yapmadan gezinme

Sitenin tamamı üye olmadan gezilebilir: ana sayfa, akış, projeler, 3B baskı istasyonu ve **açık** obaların
kanalları ile dosyaları salt okunur açılır. Paylaşım yapmak, mesaj/dosya göndermek ve **gizli** obalara girmek
giriş gerektirir.

## 📎 Oba dosya paylaşımı

Oba kanallarında mesajla birlikte dosya gönderilebilir (ataş simgesi ya da sürükle-bırak, en fazla 25 MB).
Görseller, PDF'ler, metin/kod dosyaları, ses/video ve STL modelleri indirmeden uygulama içinde görüntülenir;
diğer türler indirilir. Kabul edilen uzantılar `Karalevha.API/Services/ObaFileStorage.cs` içindedir.

Dosyalar `wwwroot` dışında, `Karalevha.API/App_Data/oba-files` klasöründe saklanır ve yetki kontrolünden
geçerek sunulur (gizli obaların dosyalarını yalnızca üyeleri açabilir). Klasörü değiştirmek için
`Storage:ObaFilesPath` ayarını kullanın.

## 🛠️ Kulüp özellikleri

- **Atölye** (`/atolye`): yazıcı, lehim istasyonu gibi ekipmanların haftalık takvimi. Üyeler boş saate tıklayıp
  rezervasyon yapar (çakışma engellenir, en fazla 12 saat, 30 gün ileriye). 3B Modeller'deki "Yazıcı ayır"
  bağlantısı modeli rezervasyona iliştirir. Ekipmanı yalnızca yöneticiler ekler; bakımdaki ekipmana rezervasyon alınmaz.
- **Etkinlikler** (`/etkinlikler`): her üye etkinlik açabilir, "Katılıyorum" der. Saat değişirse ya da iptal edilirse
  katılımcılara bildirim gider. Yaklaşan etkinlikler ana sayfada görünür.
- **Bunu bastım**: model penceresinde baskının fotoğrafı ve ayarları paylaşılır.
- **Beğeni ve yorum**: gönderi, proje ve modellerde. Yorumlarda ve oba mesajlarında `@kullaniciadi` ile birinden bahsedilebilir.
- **Bildirimler**: üst menüdeki zil (yorum, bahsetme, etkinlik değişikliği, rezervasyon iptali).
- **Profil** (`/u/kullaniciadi`) ve **genel arama** (üst menü, `/` kısayolu). Profilde tanıtım, ilgi alanları ve takip.
- **Akış**: gönderilere en fazla 3 etiket, etikete göre süzme, "Takip ettiklerim" ve son 7 günün gündemi.
  İlgi alanıyla eşleşen yeni gönderiler öne çıkar.
- **Obalar**: açık obaları herkes okur, yazmak için "Katıl". Üyeler obadan ayrılabilir, kanal açabilir.
- **Düzenleme/silme**: herkes kendi içeriğini düzenler ve siler; oba kurucusu obasındaki mesajları silebilir.

### Roller ve kulüp yöneticileri

Üç rol var: **Owner** (kurucu), **Admin** (yönetici) ve **User**. Yöneticiler ekipman ekler, gerektiğinde her içeriği
siler ve hesapları en fazla 30 gün askıya alır (profildeki "Yönetim" kutusu). Askıdaki hesap okuyabilir ama giriş
yapamaz ve hiçbir şey paylaşamaz. Owner, profillerden başkalarını yönetici yapabilir.

İlk roller yapılandırmadan gelir ve açılışta veritabanına yazılır:

```bash
dotnet user-secrets set "OwnerUsername" "kullaniciadi"
dotnet user-secrets set "Admins:0" "baska-kullanici"
```

Canlıda ortam değişkeni olarak: `OwnerUsername`, `Admins__0`, `Admins__1`, … Rol değişikliği hemen geçerli olur.

### E-posta doğrulama (isteğe bağlı)

Varsayılan olarak kapalı; hesaplar kayıt olunca kullanılabilir. Açmak için `Auth__RequireEmailVerification=true` ve
[Resend](https://resend.com) anahtarı (`Resend__ApiKey`, isteğe bağlı `Resend__FromEmail`) tanımlayın. Geliştirmede
anahtar yoksa doğrulama bağlantısı API günlüğüne yazılır.

## 🌐 Canlı Yayına Alma (Ortam Değişkenleri)

Uygulama sunucuya (Render, Railway vb.) yüklendiğinde aşağıdaki ortam değişkenlerini tanımlamanız gerekir:

| Değişken | Değer |
| --- | --- |
| `Jwt__Key` | Yeni üretilmiş gizli anahtarınız (32+ bayt) |
| `ConnectionStrings__DefaultConnection` | Npgsql biçiminde PostgreSQL bağlantı dizeniz |
| `Cors__Origins__0` | `https://karalevha.vercel.app` (sonda / yok) |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `Storage__ObaFilesPath` | (İsteğe bağlı) Kalıcı diskteki dosya klasörü |
| `Admins__0` | (İsteğe bağlı) Kulüp yöneticisinin kullanıcı adı |

> **Not:** Render gibi platformlarda konteyner diski kalıcı değildir; yeniden dağıtımda yüklenen dosyalar
> (STL'ler ve oba dosyaları) silinir. Canlıda kalıcı bir disk bağlayıp `Storage__ObaFilesPath` ile gösterin.
