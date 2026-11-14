/** @type {import('tailwindcss').Config} */
// Tasarım kuralları için DESIGN.md'ye bakın. Buradaki ölçekler bilerek dar tutuldu:
// listede olmayan bir yazı boyutu ya da renk kullanmak yerine en yakınını seçin.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Yazı ölçeği: yalnızca altı boyut (Tailwind'in varsayılanlarının yerine geçer)
    fontSize: {
      xs: ['12px', { lineHeight: '16px' }],                              // tarih, sayı, dosya boyutu
      sm: ['14px', { lineHeight: '20px' }],                              // ikincil metin, buton, form etiketi
      base: ['16px', { lineHeight: '24px' }],                            // gövde metni
      lg: ['20px', { lineHeight: '28px', letterSpacing: '-0.01em' }],    // bölüm başlığı
      xl: ['28px', { lineHeight: '36px', letterSpacing: '-0.02em' }],    // sayfa başlığı
      '2xl': ['40px', { lineHeight: '44px', letterSpacing: '-0.025em' }], // yalnızca ana sayfa başlığı
      '3xl': ['72px', { lineHeight: '72px' }],                           // yalnızca ana sayfadaki graffiti imzası
    },
    // Köşeler: sokak afişi/çıkartma gibi neredeyse keskin
    borderRadius: {
      none: '0',
      sm: '1px',
      DEFAULT: '2px',
      md: '2px',
      lg: '3px',
      xl: '4px',
      full: '9999px',
    },
    extend: {
      // Karalevha kimliği: asfalt/beton zemin, kâğıt beyazı yazı, tek vurgu olarak fosforlu sprey.
      // Sprey pembesi yalnızca graffiti işaretleri ve maskot için (DESIGN.md).
      colors: {
        levha: {
          DEFAULT: '#121212', // asfalt: sayfa zemini
          koyu: '#0a0a0a',    // çukur alanlar (girdi, kod, önizleme)
          yuzey: '#1c1c1c',   // beton: kart, menü, pencere
          cizgi: '#2e2e2e',   // kenarlık ve ayırıcı
        },
        tebesir: {
          DEFAULT: '#ecebe6', // kâğıt beyazı ana yazı (zemine karşı 15:1)
          soluk: '#a8a7a0',   // ikincil yazı          (8:1)
          silik: '#878680',   // ipucu, tarih, sayaç   (5:1, AA sınırının üstünde)
        },
        isaret: {
          DEFAULT: '#d4ff3d', // fosforlu sprey: tek vurgu (ana buton, etkin sekme, odak çizgisi)
          acik: '#e4ff7f',
        },
        sprey: {
          DEFAULT: '#ff4f9a', // graffiti işaretleri ve maskot; metin ya da buton rengi değil
          koyu: '#c2185b',
        },
        hata: '#f2836f',
        basari: '#8fcf8a',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        // Dar, ağır, afiş/tabela havası. Başlıklar büyük harf (index.css)
        display: ['"Big Shoulders Display Variable"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        // Graffiti imzası: yalnızca KaraLevha yazısı ve 404 gibi tek kelimelik işaretler (DESIGN.md)
        tag: ['"Sedgwick Ave Display"', 'cursive'],
      },
      maxWidth: {
        sayfa: '72rem',  // 1152px: tüm sayfaların içerik genişliği
        okuma: '42rem',  // 672px: akış ve uzun metin
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
}
