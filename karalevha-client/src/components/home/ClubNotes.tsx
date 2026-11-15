/** Kulüp tüzüğünden kısa özetler. Her notun yanında konusuna uygun bir model basılır (printModels.ts). */
export interface ClubNote {
  title: string;
  text: string;
  /** PRINT_MODELS içindeki modelin adı */
  model: string;
}

export const CLUB_NOTES: ClubNote[] = [
  {
    title: 'Maker kültürü',
    text: 'Kendi becerinle proje geliştirdiğin, teknolojiyle zanaatın bir arada olduğu bir kendin-yap (DIY) hareketi. Yapılanlar açık kaynak paylaşılır.',
    model: '3B yazıcı',
  },
  {
    title: 'Dünyada makerlar',
    text: 'Atıktan işlevsel ürünler, sürdürülebilir tarım teknolojileri, modern tasarımla yeniden canlanan zanaatlar ve ihtiyaç sahipleri için yardımcı cihazlar üretiyor.',
    model: 'devre kartı',
  },
  {
    title: 'Bu kulüp',
    text: 'Teknoloji projelerinin yanında geleneksel zanaatı, çevre dostu işleri ve sosyal sorumluluk çalışmalarını bir araya getiriyor.',
    model: 'kafatası',
  },
  { title: 'Geleneksel zanaat', text: 'Ahşap oyma, seramik ve dokuma atölyeleri.', model: 'vazo' },
  { title: 'Geri dönüşüm', text: 'Atık malzemeden yeni ve işe yarar ürünler.', model: 'pet şişe' },
  { title: 'Yenilenebilir enerji', text: 'Güneş ve rüzgârla çalışan küçük ölçekli enerji sistemleri.', model: 'rüzgâr türbini' },
  { title: 'DIY atölyeleri', text: 'Gündelik hayata ve teknolojiye dönük projelerle beceri geliştirme.', model: 'dişli' },
  { title: 'Sosyal sorumluluk', text: 'İhtiyaç sahipleri için açık kaynaklı, düşük maliyetli cihazlar.', model: 'protez el' },
  { title: 'Teknoloji', text: 'Arduino ve Raspberry Pi ile robotik, uzaktan kumandalı araçlar ve otomasyon.', model: 'robot' },
];

// Uygulama açıkken son gösterilen not: ana sayfaya her dönüşte farklı biri gelsin
let lastShown = -1;

/** Ana sayfa her açıldığında çağrılır: bir öncekinden farklı, rastgele bir not (yan etkisiz) */
export function pickNote(): ClubNote {
  let next = Math.floor(Math.random() * CLUB_NOTES.length);
  if (next === lastShown) next = (next + 1 + Math.floor(Math.random() * (CLUB_NOTES.length - 1))) % CLUB_NOTES.length;
  return CLUB_NOTES[next];
}

/**
 * Gösterilen notu kaydet. Ekrana çıktıktan sonra (useEffect) çağrılır: React geliştirmede başlangıç
 * fonksiyonlarını iki kez çalıştırdığından seçim anında kaydetmek yanlış notu yazabilirdi.
 */
export function rememberNote(note: ClubNote) {
  lastShown = CLUB_NOTES.indexOf(note);
}

/** Başlığın altındaki not: yalnızca başlık ve metin */
export default function ClubNotes({ note }: { note: ClubNote }) {
  return (
    <div className="max-w-sm">
      <h2 className="text-base font-semibold text-tebesir">{note.title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-tebesir-soluk">{note.text}</p>
    </div>
  );
}
