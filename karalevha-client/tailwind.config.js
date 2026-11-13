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
    },
    extend: {
      // Karalevha kimliği: mat kara tahta zemini, tebeşir beyazı yazı, tek bir işaret rengi.
      colors: {
        levha: {
          DEFAULT: '#14181a', // sayfa zemini
          koyu: '#0e1112',    // çukur alanlar (girdi, kod, önizleme)
          yuzey: '#1b2023',   // kart, menü, pencere
          cizgi: '#2a3135',   // kenarlık ve ayırıcı
        },
        tebesir: {
          DEFAULT: '#ece7dc', // ana yazı            (zemine karşı 15:1)
          soluk: '#a9aaa2',   // ikincil yazı        (7.6:1)
          silik: '#8b918d',   // ipucu, tarih, sayaç (5.6:1, AA sınırının üstünde)
        },
        isaret: {
          DEFAULT: '#f2c230', // tek vurgu rengi: ana buton, etkin sekme, odak çizgisi
          acik: '#f7d566',
        },
        hata: '#f2836f',
        basari: '#8fcf8a',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
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
