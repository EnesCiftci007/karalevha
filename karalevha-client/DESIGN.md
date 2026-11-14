# KaraLevha tasarım kuralları

Sitenin her sayfası bu kurallara uyar. Yeni bir sayfa ya da bileşen yazarken önce buraya,
sonra canlı kataloğa (`/tasarim` sayfası) bakın. Bir şey yanlış görünüyorsa sayfada değil,
ortak parçada düzeltin; bütün site birlikte düzelir.

Kimlik: **asfalt ve beton zemin, kâğıt beyazı yazı, tek vurgu olarak fosforlu sprey; sokak afişi ve graffiti
havası.** Resmî kurum sitesi gibi değil, kulübün duvarı gibi durur. Ama süs değil düzen öne çıkar.

## 0. Sokak teması ve dil

- **Yapmacık metin yok.** Slogan, kampanya cümlesi, "dijital buluşma noktası" gibi kalıplar, temalı kelime
  oyunları kullanılmaz. Metin ne olduğunu düz söyler: "Projeler", "Kayıt ol", "Sayfa bulunamadı".
- **Yazı normal kalır:** süslü, graffiti ya da afiş yazı tipi kullanılmaz. Sokak havası renk, doku ve küçük
  işaretlerle verilir: etkin menü öğesinin altında elle çekilmiş sprey çizgisi (`.sprey-alti`), çıkartma rozetler.
- **Dokular hafif:** gövdede neredeyse görünmez beton kumlanması, ana sayfa karşılamasında fotokopi yarım tonu
  (`.kareli`). Parlama (glow), gradyan yazı, neon gölge yok.
- **Köşeler neredeyse keskin** (2-4 px), afiş ve çıkartma gibi. "Kurucu" gibi önemli rozetler sprey renginde
  hafif eğik çıkartma olarak durur.
- **Logo motifi:** logodaki 24° eğik çerçeve (`Logo`, `Mascot`, `TiltMark`). Yeni motif icat etme.
- **Maskot (`<Mascot>`)** yalnızca giriş ekranı, 404 ve alt bilgide.
- **Sprey pembesi (`sprey`)** yalnızca maskot çerçevesinde. Metin, buton ya da vurgu rengi değil.
- **Ana sayfa sahnesi:** yazıcı maskotun kafatasını katman katman basar (`components/home/PrintScene.tsx`).

## 1. Yazı

Yalnızca altı boyut var (`tailwind.config.js` içinde Tailwind'in varsayılanlarının yerine geçer).
`text-[13px]` gibi ölçek dışı boyutlar **kullanılmaz**.

| Sınıf | Boyut | Ne için |
| --- | --- | --- |
| `text-xs` | 12 px | Tarih, sayaç, dosya boyutu, alan yardım metni |
| `text-sm` | 14 px | İkincil metin, buton, form alanı ve etiketi, menü |
| `text-base` | 16 px | Gövde metni, liste başlıkları |
| `text-lg` | 20 px | Bölüm başlığı (`h2`), pencere başlığı |
| `text-xl` | 28 px | Sayfa başlığı (`h1`) |
| `text-2xl` | 40 px | Yalnızca ana sayfadaki KaraLevha başlığı |

- **Yazı tipleri:** başlık ve metin IBM Plex Sans (`font-display` başlıklar için aynı aile, daha kalın),
  veri `font-mono` (IBM Plex Mono). Başka yazı tipi eklenmez.
- **Kalınlık:** 400 metin, 500 vurgu ve etiket, 600 buton, liste ve bölüm başlığı, 700 sayfa başlığı.
- **Büyük harf yok.** Başlık dahil her yerde cümle düzeni: "Yeni proje", "YENİ PROJE" değil. Geniş harf
  aralığı (`tracking-widest`) kullanılmaz.
- **Mono yalnızca veri için:** sayı, boyut, depo adresi, kod. Hazır sınıf: `.veri`. Etiket ya da başlıkta kullanılmaz.

## 2. Renk

| Belirteç | Ne için |
| --- | --- |
| `levha` | Sayfa zemini |
| `levha-koyu` | Çukur alanlar: form alanı, kod, önizleme |
| `levha-yuzey` | Kart üstü vurgu, menü, pencere, üzerine gelme |
| `levha-cizgi` | Bütün kenarlık ve ayırıcılar |
| `tebesir` | Ana yazı |
| `tebesir-soluk` | İkincil yazı (açıklama) |
| `tebesir-silik` | İpucu, tarih, sayaç. Zemine karşı 5.4:1, okunabilirlik sınırının (4.5:1) üstünde |
| `isaret` | **Tek vurgu rengi** (fosforlu sprey) |
| `sprey` | Yalnızca maskot çerçevesi |
| `hata`, `basari` | Yalnızca hata ve başarı mesajları |

- **Fosforlu sprey yalnızca üç yerde** (logo ve bölüm başlıklarındaki küçük eğik işaret marka parçası sayılır): ana buton, "şu an buradasın" işareti (etkin menü, seçili öğe), odak çizgisi.
  Bağlantıların üzerine gelince sarıya dönmesi bunun dışında kabul edilen tek istisna. Süs için sarı kullanılmaz.
- Başka renk eklenmez; pembe yalnızca maskotta. Neon parlama, gradyan, gölgeli yazı yok. Bölümler renkle değil başlık ve simgeyle ayrılır.
- Gölge yok; ayrım kenarlık ve zemin tonuyla yapılır. Tek istisna açılır pencere (`Modal`).

## 3. Boşluk ve ölçü

- Tailwind'in 4 px tabanlı ölçeği: `1` (4), `2` (8), `3` (12), `4` (16), `6` (24), `8` (32), `12` (48), `16` (64).
  `mt-[13px]` gibi ölçek dışı değerler kullanılmaz.
- **Sayfa iskeleti:** içerik genişliği `max-w-sayfa` (1152 px), yanlarda `px-4 sm:px-6`, üstte 32 px.
  Bunu `MainLayout` sağlar; sayfalar kendi dış boşluğunu eklemez.
- **Okuma genişliği:** uzun metin ve akış `max-w-okuma` (672 px).
- **Dikey ritim:** sayfa başlığı ile içerik arası 32 px (`PageHeader` sağlar), bölümler arası 48 px,
  bir bölümün içindeki öğeler arası 16 px.
- **Köşeler:** tema 2-4 px'e sabitlenmiştir: buton ve form alanı `rounded-md`, kart `rounded-lg`, pencere `rounded-xl`, avatar `rounded-full`.
- **Yükseklik:** buton ve tek satırlık form alanı 36 px (`h-9`). Dokunmatik hedefler en az 36 px.

## 4. Hareket

- Yalnızca renk, kenarlık ve saydamlık geçişi, 150 ms.
- Kayan, büyüyen, zıplayan, parlayan efekt yok (`hover:-translate-*`, `hover:scale-*`, `blur`, neon gölge).
- "Hareketi azalt" tercihi açıksa geçişler kapanır (`index.css`).
- Ana sayfadaki 3B sahne tek istisnadır ve ekranda değilken durur.

## 5. Ortak parçalar

Sayfalar kendi buton, form alanı ya da kutu stilini icat etmez; bunları kullanır.

| Parça | Nerede |
| --- | --- |
| Butonlar: `.btn-ana`, `.btn-ikincil`, `.btn-sade`, `.btn-tehlike` | `src/index.css` |
| Form alanı: `.girdi`, etiket: `.alan-etiketi`, iskelet: `<Field>` | `index.css`, `components/ui/Field.tsx` |
| Kart: `.kart` | `index.css` |
| Küçük metin: `.etiket`, veri: `.veri` | `index.css` |
| `<PageHeader>` | Her sayfanın başlığı (geri bağlantısı ve ana eylemle) |
| `<Modal>` | Bütün açılır pencereler (Esc ile kapanır) |
| `<Tabs>` | 2-4 seçenekli bölümlü seçici |
| `<Badge>` | "Gizli", "Kurucu" gibi durum etiketleri |
| `<Avatar>` | Kullanıcı ve oba simgesi (baş harf) |
| `<EmptyState>` | Boş ya da yüklenemeyen liste |
| `<Skeleton>`, `<SkeletonRows>` | Yükleniyor durumu |

**Buton kuralı:** bir ekranda en fazla bir `btn-ana`. Geri kalan eylemler `btn-ikincil` ya da `btn-sade`.

## 6. Yazım dili

- Kısa ve doğrudan: "Proje ekle", "Kaydet", "Vazgeç". Ünlem ve abartı yok.
- Boş durumlar ne olduğunu söyler ve bir sonraki adımı önerir: "Henüz proje yok." + "İlk projeyi ekle".
- Hata mesajı ne olduğunu ve ne yapılacağını söyler; `alert()` kullanılmaz, mesaj formun içinde gösterilir.

## 7. Erişilebilirlik

- Her form alanının görünür bir etiketi var (`<Field>`); yalnızca yer tutucu metin yeterli değil.
- Yalnızca simgeden oluşan butonlarda `aria-label` zorunlu.
- Klavye odağı her zaman görünür (sarı çizgi, `index.css`).
- Renk tek başına bilgi taşımaz: "Gizli" oba hem kilit simgesi hem yazıyla belirtilir.
