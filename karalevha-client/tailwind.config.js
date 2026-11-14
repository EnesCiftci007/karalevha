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
      // Karalevha kimliği: gece denizi tonunda kara tahta, kemik/parşömen yazı, tek vurgu olarak altın
      // dublon. Korsan moru yalnızca maskot ve marka anlarında kullanılır (DESIGN.md).
      colors: {
        levha: {
          DEFAULT: '#11161a', // sayfa zemini
          koyu: '#0b0f12',    // çukur alanlar (girdi, kod, önizleme)
          yuzey: '#192026',   // kart, menü, pencere
          cizgi: '#283139',   // kenarlık ve ayırıcı
        },
        tebesir: {
          DEFAULT: '#efe7d6', // ana yazı, kemik beyazı (zemine karşı 15:1)
          soluk: '#b3ab9a',   // ikincil yazı                 (8:1)
          silik: '#8f8b80',   // ipucu, tarih, sayaç          (5.4:1, AA sınırının üstünde)
        },
        isaret: {
          DEFAULT: '#e9b545', // dublon altını: tek vurgu rengi (ana buton, etkin sekme, odak çizgisi)
          acik: '#f3cd72',
        },
        korsan: {
          DEFAULT: '#a447b8', // maskot çerçevesi ve marka anları; metin ya da buton rengi değil
          koyu: '#7a007a',
        },
        hata: '#f2836f',
        basari: '#8fcf8a',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        // Yalnızca marka yazısı ve kısa "damga" vurguları için (DESIGN.md)
        korsan: ['"Pirata One"', '"Bricolage Grotesque Variable"', 'serif'],
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
