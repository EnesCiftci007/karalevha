/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Karalevha kimliği: mat kara tahta zemini, tebeşir beyazı yazı, tek bir işaret rengi.
      colors: {
        levha: {
          DEFAULT: '#14181a', // sayfa zemini
          koyu: '#0e1112',    // çukur alanlar (girdi, kod)
          yuzey: '#1b2023',   // kartlar, menü
          cizgi: '#2a3135',   // kenarlıklar
        },
        tebesir: {
          DEFAULT: '#ece7dc', // ana yazı
          soluk: '#a9aaa2',   // ikincil yazı
          silik: '#6d7370',   // etiket, ipucu
        },
        isaret: {
          DEFAULT: '#f2c230', // tek vurgu rengi (sarı tebeşir)
          acik: '#f7d566',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      }
    },
  },
  plugins: [],
}
