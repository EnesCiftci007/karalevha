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

Site http://localhost:5173 adresinde açılır. Farklı bir API adresi için `VITE_API_URL` tanımlayın (yerelde
varsayılan `http://localhost:5114`; localhost'un portları aynı site sayıldığı için oturum çerezi yine çalışır).

## ✅ Testler

API'nin entegrasyon testleri `Karalevha.API.Tests` klasöründedir ve gerçek PostgreSQL üzerinde çalışır
(PostgreSQL'e özgü sorgular ve migration'lar da sınanır). Her çalıştırmada `karalevha_test` veritabanı
sıfırdan kurulur; geliştirme veritabanınıza dokunulmaz. Yerelde veritabanını başlatıp çalıştırın:

```bash
dotnet test Karalevha.API.Tests
```

Bağlantı `KARALEVHA_TEST_DB` ortam değişkeninden alınır; yoksa API'nin user-secrets'taki bağlantısı
kullanılır ve veritabanı adı `karalevha_test` yapılır. Testlerde istek sınırları kapalıdır
(`RateLimits:Disabled`) ve dosyalar geçici bir klasöre yazılır.

GitHub'da her PR'da `.github/workflows/ci.yml` çalışır: API testleri, istemcinin lint ve derlemesi,
Docker imajının derlenmesi.

## 👀 Giriş yapmadan gezinme

Sitenin tamamı üye olmadan gezilebilir: ana sayfa, akış, projeler, 3B baskı istasyonu ve **açık** obaların
kanalları ile dosyaları salt okunur açılır. Paylaşım yapmak, mesaj/dosya göndermek ve **gizli** obalara girmek
giriş gerektirir.

## 📎 Oba dosya paylaşımı

Oba kanallarında mesajla birlikte dosya gönderilebilir (ataş simgesi ya da sürükle-bırak, en fazla 25 MB).
Görseller, PDF'ler, metin/kod dosyaları, ses/video ve STL modelleri indirmeden uygulama içinde görüntülenir;
diğer türler indirilir. Kabul edilen uzantılar `Karalevha.API/Services/ObaFileStorage.cs` içindedir.

Oba dosyaları herkese açık `/uploads` dışında tutulur ve yetki kontrolünden geçerek sunulur (gizli obaların
dosyalarını yalnızca üyeleri açabilir). Nerede saklandıkları için aşağıdaki **Dosya deposu** bölümüne bakın.

## 🗄️ Dosya deposu

Yüklenen her şey (3B modeller, baskı fotoğrafları, proje dosyaları, oba dosyaları, Market sipariş dosyaları)
tek bir depodan geçer: `Karalevha.API/Services/FileStore.cs`. İki seçenek var:

- **Yerel disk** (varsayılan): geliştirmede ayar gerekmez. Herkese açıklar `wwwroot/uploads`, gizliler
  `App_Data/oba-files` ve `App_Data/market` altındadır. Sunucuda kalıcı bir disk varsa `Storage__LocalRoot`
  ile o klasörü gösterin.
- **S3 uyumlu nesne deposu** (canlı için önerilen): Cloudflare R2, AWS S3, Backblaze B2, MinIO. Konteyner
  yeniden kurulunca dosyalar kaybolmaz.

Hangisi seçilirse seçilsin dosyalar aynı adreslerden (`/uploads/...`) sunulur; veritabanı ve istemci değişmez.
Gizli dosyalar (oba, sipariş) her zaman yetki denetleyen API uçlarından okunur.

**Cloudflare R2 kurulumu:** R2'de bir kova (bucket) açın, *Manage R2 API Tokens* ile o kovaya okuma-yazma
izni olan bir anahtar oluşturun ve API'ye şu ortam değişkenlerini verin:

| Değişken | Değer |
| --- | --- |
| `Storage__Provider` | `s3` |
| `Storage__S3__ServiceUrl` | `https://<HESAP_ID>.r2.cloudflarestorage.com` |
| `Storage__S3__Bucket` | Kovanın adı (ör. `karalevha`) |
| `Storage__S3__AccessKey` | R2 erişim anahtarı |
| `Storage__S3__SecretKey` | R2 gizli anahtarı |
| `Storage__S3__Region` | `auto` (R2), AWS'de kovanın bölgesi |

Kova herkese açık olmak zorunda değildir; dosyaları API sunar.

**Eski dosyaları depoya taşımak:** S3 ayarları tanımlıyken bir kez çalıştırın. Yerel `wwwroot/uploads` ve
`App_Data` altındaki dosyalar kovaya kopyalanır; kovada olanlar atlanır, yerel dosyalar silinmez.

```bash
dotnet run --project Karalevha.API -- --depoya-aktar
```

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

Roller yalnızca veritabanında durur; **kayıt hiçbir koşulda rol vermez** ve yapılandırmadan rol okunmaz
(eski `OwnerUsername` / `Admins` ayarları artık yok sayılır, silinebilir). Kulübün **en fazla bir Owner'ı** olur;
bunu veritabanındaki `IX_Users_SingleOwner` indeksi garanti eder.

**İlk Owner (tek seferlik kurulum):**

1. Sunucuya en az 32 karakterlik rastgele bir anahtar verin: `Bootstrap__OwnerToken` (yerelde
   `dotnet user-secrets set "Bootstrap:OwnerToken" "..."`). Anahtar hiçbir yerde loglanmaz.
2. Kurucu olacak hesapla giriş yapıp `/kurulum` sayfasında anahtarı girin.
3. Owner oluşunca kurulum kalıcı olarak kapanır; anahtarı sunucudan silebilirsiniz.

Sonrasında Owner, profillerden başkalarını yönetici yapar ve kuruculuğu **"Kuruculuğu devret"** ile başka birine
verir (şifre yeniden istenir; devreden aynı işlemde Admin olur). Rol değişikliği hemen geçerli olur.

Canlıya almadan önce veritabanında birden fazla Owner olmadığını salt okunur kontrol edin (birden fazlaysa
tek-Owner migration'ı uygulanmaz):

```sql
SELECT "Id", "Username" FROM "Users" WHERE "Role" = 'Owner';
```

### E-posta doğrulama (isteğe bağlı)

Varsayılan olarak kapalı; hesaplar kayıt olunca kullanılabilir. Açıkken her e-posta adresiyle kayıt olunur ama
hesap, e-postadaki bağlantıya tıklanınca açılır (bağlantı 24 saat geçerli; süresi dolmuş doğrulanmamış bir kayıt
adresi kilitlemez, aynı adresle yeniden kayıt olunabilir).

Açmak için:

1. [Resend](https://resend.com)'de hesap açın ve **Domains** bölümünden kulübün alan adını ekleyip DNS kayıtlarını
   girin (alan adı doğrulanmadan Resend yalnızca hesap sahibinin kendi adresine e-posta gönderir).
2. **API Keys** bölümünden yalnızca gönderme izni olan bir anahtar oluşturun.
3. API sunucusuna şu ortam değişkenlerini girin:

| Değişken | Değer |
| --- | --- |
| `Auth__RequireEmailVerification` | `true` |
| `Resend__ApiKey` | Resend anahtarı (`re_...`) |
| `Resend__FromEmail` | Doğrulanmış alan adından bir adres, ör. `noreply@kulup-alan-adi.com` |
| `Cors__Origins__0` | Sitenin adresi; e-postadaki bağlantı buna gider |

Anahtar tanımlı değilken doğrulama açılırsa API canlıda açılmaz ve nedenini yazar. Geliştirmede anahtar yoksa
doğrulama bağlantısı API günlüğüne yazılır. Doğrulama açılmadan önce açılmış hesaplar doğrulanmış sayılır.

## 🌐 Canlı Yayına Alma (Ortam Değişkenleri)

Uygulama sunucuya (Render, Railway vb.) yüklendiğinde aşağıdaki ortam değişkenlerini tanımlamanız gerekir:

| Değişken | Değer |
| --- | --- |
| `Jwt__Key` | Yeni üretilmiş gizli anahtarınız (32+ bayt) |
| `ConnectionStrings__DefaultConnection` | Npgsql biçiminde PostgreSQL bağlantı dizeniz |
| `Cors__Origins__0` | `https://karalevha.vercel.app` (sonda / yok) |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `Storage__Provider` ve `Storage__S3__*` | Yüklenen dosyaların deposu (R2/S3), bkz. **Dosya deposu** |
| `Bootstrap__OwnerToken` | (İlk kurulum için, 32+ karakter) Owner kurulum anahtarı; kurulumdan sonra silinebilir |
| `Proxy__ForwardLimit` | `2` (site Vercel üzerinden yönlendiriyorsa; bkz. aşağı) |

### Site ve API aynı adreste (oturum çerezi)

Oturum, tarayıcıda JavaScript'in okuyamadığı bir çerezde (`HttpOnly`) tutulur. Çerezin Safari dahil her
tarayıcıda çalışması için site ve API tarayıcıya **aynı adres** gibi görünmelidir: Vercel, `/api`, `/uploads`,
`/chathub` ve `/notificationhub` yollarını API'ye yönlendirir (`karalevha-client/vercel.json`).

- API başka bir adreste çalışıyorsa `vercel.json` içindeki `https://karalevha.onrender.com` adreslerini değiştirin.
- Vercel'de `VITE_API_URL` **tanımlamayın**; istemci canlıda API'ye kendi adresinden (`/api/...`) gider.
- API'de `Proxy__ForwardLimit=2` verin (Vercel → Render iki vekil): yoksa istek sınırları ziyaretçinin değil
  Vercel'in IP'sine göre işler ve örneğin dakikada 5 giriş denemesi herkes için ortak olur.
- Vercel bu yönlendirmede WebSocket taşımaz; canlı sohbet ve bildirimler SignalR'ın yedek yöntemiyle
  (Server-Sent Events / long polling) kendiliğinden çalışır. Vercel yönlendirilen isteklere 120 saniye süre tanır.

> **Not:** Render gibi platformlarda konteyner diski kalıcı değildir; yerel disk deposuyla yeniden dağıtımda
> yüklenen bütün dosyalar silinir. Canlıda `Storage__Provider=s3` ile R2/S3 kullanın (ya da kalıcı bir disk
> bağlayıp `Storage__LocalRoot` ile gösterin).
